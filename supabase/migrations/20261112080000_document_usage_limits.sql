-- Document/storage limits. Runtime values are owner-configured in app_config.document_limits.
-- No live configuration or data is changed by this source migration.

create or replace function private.enforce_document_page_limits()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_plan text;
  v_limits jsonb;
  v_max_total_pages integer;
  v_max_total_text_chars integer;
  v_max_pages_per_document integer;
  v_total_pages integer;
  v_total_text_chars bigint;
  v_document_pages integer;
begin
  select p.plan into v_plan
    from public.profiles p
   where p.id = new.user_id
   for update;
  if not found then
    raise exception 'DOCUMENT_LIMIT_PROFILE_MISSING' using errcode = 'P0001';
  end if;

  select c.value -> v_plan into v_limits
    from public.app_config c
   where c.key = 'document_limits';
  if v_limits is null or jsonb_typeof(v_limits) is distinct from 'object'
     or jsonb_typeof(v_limits->'max_total_pages') is distinct from 'number'
     or jsonb_typeof(v_limits->'max_total_text_chars') is distinct from 'number'
     or jsonb_typeof(v_limits->'max_pages_per_document') is distinct from 'number' then
    raise exception 'DOCUMENT_LIMIT_CONFIGURATION_MISSING' using errcode = 'P0001';
  end if;

  v_max_total_pages := (v_limits->>'max_total_pages')::integer;
  v_max_total_text_chars := (v_limits->>'max_total_text_chars')::integer;
  v_max_pages_per_document := (v_limits->>'max_pages_per_document')::integer;
  if v_max_total_pages < 1 or v_max_total_text_chars < 1 or v_max_pages_per_document < 1 then
    raise exception 'DOCUMENT_LIMIT_CONFIGURATION_INVALID' using errcode = 'P0001';
  end if;

  select count(*)::integer, coalesce(sum(char_length(dp.text)), 0)::bigint
    into v_total_pages, v_total_text_chars
    from public.document_pages dp
   where dp.user_id = new.user_id
     and not (dp.document_id = new.document_id and dp.page_no = new.page_no);

  select count(*)::integer into v_document_pages
    from public.document_pages dp
   where dp.user_id = new.user_id
     and dp.document_id = new.document_id
     and dp.page_no <> new.page_no;

  if v_total_pages + 1 > v_max_total_pages then
    raise exception 'DOCUMENT_LIMIT_TOTAL_PAGES' using errcode = 'P0001';
  end if;
  if v_total_text_chars + char_length(new.text) > v_max_total_text_chars then
    raise exception 'DOCUMENT_LIMIT_TOTAL_TEXT_CHARS' using errcode = 'P0001';
  end if;
  if v_document_pages + 1 > v_max_pages_per_document or new.page_no > v_max_pages_per_document then
    raise exception 'DOCUMENT_LIMIT_PER_DOCUMENT_PAGES' using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

drop trigger if exists document_pages_enforce_usage_limits on public.document_pages;
create trigger document_pages_enforce_usage_limits
before insert or update of text, page_no, document_id, user_id
on public.document_pages
for each row execute function private.enforce_document_page_limits();

revoke all on function private.enforce_document_page_limits() from public, anon, authenticated;

create or replace function public.create_document_upload_record(
  p_document_id uuid,
  p_user_id uuid,
  p_title text,
  p_storage_path text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_plan text;
  v_limits jsonb;
  v_max_documents integer;
  v_max_pending_uploads integer;
  v_stale_uploaded_minutes integer;
  v_document_count integer;
  v_pending_count integer;
  v_total_pages integer;
  v_total_text_chars bigint;
  v_expired_paths text[] := array[]::text[];
begin
  if p_document_id is null or p_user_id is null
     or p_title is null or char_length(btrim(p_title)) not between 1 and 255
     or p_storage_path is distinct from (p_user_id::text || '/' || p_document_id::text || '.pdf') then
    return jsonb_build_object('ok', false, 'error_code', 'DOCUMENT_UPLOAD_INVALID_INPUT');
  end if;

  select p.plan into v_plan
    from public.profiles p
   where p.id = p_user_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'DOCUMENT_LIMIT_PROFILE_MISSING');
  end if;

  select c.value -> v_plan into v_limits
    from public.app_config c
   where c.key = 'document_limits';
  if v_limits is null or jsonb_typeof(v_limits) is distinct from 'object'
     or jsonb_typeof(v_limits->'max_documents') is distinct from 'number'
     or jsonb_typeof(v_limits->'max_pending_uploads') is distinct from 'number'
     or jsonb_typeof(v_limits->'max_total_pages') is distinct from 'number'
     or jsonb_typeof(v_limits->'max_total_text_chars') is distinct from 'number'
     or jsonb_typeof(v_limits->'max_pages_per_document') is distinct from 'number'
     or jsonb_typeof(v_limits->'stale_uploaded_minutes') is distinct from 'number' then
    return jsonb_build_object('ok', false, 'error_code', 'DOCUMENT_LIMIT_CONFIGURATION_MISSING');
  end if;

  v_max_documents := (v_limits->>'max_documents')::integer;
  v_max_pending_uploads := (v_limits->>'max_pending_uploads')::integer;
  v_stale_uploaded_minutes := (v_limits->>'stale_uploaded_minutes')::integer;
  if v_max_documents < 1 or v_max_pending_uploads < 1 or v_stale_uploaded_minutes < 1
     or (v_limits->>'max_total_pages')::integer < 1
     or (v_limits->>'max_total_text_chars')::bigint < 1
     or (v_limits->>'max_pages_per_document')::integer < 1 then
    return jsonb_build_object('ok', false, 'error_code', 'DOCUMENT_LIMIT_CONFIGURATION_INVALID');
  end if;

  with expired as (
    delete from public.documents d
     where d.user_id = p_user_id
       and d.status = 'uploaded'
       and d.created_at < now() - make_interval(mins => v_stale_uploaded_minutes)
    returning d.storage_path
  )
  select coalesce(array_agg(expired.storage_path), array[]::text[])
    into v_expired_paths
    from expired;

  select count(*)::integer into v_document_count
    from public.documents d where d.user_id = p_user_id;
  if v_document_count >= v_max_documents then
    return jsonb_build_object('ok', false, 'error_code', 'DOCUMENT_LIMIT_DOCUMENTS', 'expired_paths', to_jsonb(v_expired_paths));
  end if;

  select count(*)::integer into v_pending_count
    from public.documents d
   where d.user_id = p_user_id and d.status in ('uploaded', 'processing');
  if v_pending_count >= v_max_pending_uploads then
    return jsonb_build_object('ok', false, 'error_code', 'DOCUMENT_LIMIT_PENDING_UPLOADS', 'expired_paths', to_jsonb(v_expired_paths));
  end if;

  select count(*)::integer, coalesce(sum(char_length(dp.text)), 0)::bigint
    into v_total_pages, v_total_text_chars
    from public.document_pages dp where dp.user_id = p_user_id;
  if v_total_pages >= (v_limits->>'max_total_pages')::integer then
    return jsonb_build_object('ok', false, 'error_code', 'DOCUMENT_LIMIT_TOTAL_PAGES', 'expired_paths', to_jsonb(v_expired_paths));
  end if;
  if v_total_text_chars >= (v_limits->>'max_total_text_chars')::bigint then
    return jsonb_build_object('ok', false, 'error_code', 'DOCUMENT_LIMIT_TOTAL_TEXT_CHARS', 'expired_paths', to_jsonb(v_expired_paths));
  end if;

  insert into public.documents(id, user_id, title, storage_path, status, kind)
  values (p_document_id, p_user_id, btrim(p_title), p_storage_path, 'uploaded', 'other');

  return jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'expired_paths', to_jsonb(v_expired_paths)
  );
end;
$function$;

revoke all on function public.create_document_upload_record(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_document_upload_record(uuid, uuid, text, text)
  to service_role;
