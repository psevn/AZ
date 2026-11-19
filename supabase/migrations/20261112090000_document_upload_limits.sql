-- Per-user document, page, text, and active-upload quotas.
-- All limits are owner-configured in app_config.document_limits; no product caps are hardcoded here.
create function public.create_document_upload_record(
  p_user_id uuid,
  p_document_id uuid,
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
  v_max_pages integer;
  v_max_text_chars bigint;
  v_max_active_uploads integer;
  v_stale_uploaded_minutes integer;
  v_documents bigint;
  v_pages bigint;
  v_text_chars bigint;
  v_active bigint;
begin
  if p_user_id is null or p_document_id is null
     or nullif(btrim(p_title), '') is null
     or char_length(p_title) > 255
     or p_storage_path is distinct from (p_user_id::text || '/' || p_document_id::text || '.pdf') then
    return jsonb_build_object('ok', false, 'statusCode', 400, 'code', 'INVALID_DOCUMENT_INPUT');
  end if;

  select p.plan into v_plan
    from public.profiles p
   where p.id = p_user_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'statusCode', 404, 'code', 'USER_NOT_FOUND');
  end if;

  select c.value -> v_plan into v_limits
    from public.app_config c
   where c.key = 'document_limits';
  if v_limits is null
     or jsonb_typeof(v_limits -> 'max_documents') is distinct from 'number'
     or jsonb_typeof(v_limits -> 'max_pages') is distinct from 'number'
     or jsonb_typeof(v_limits -> 'max_text_chars') is distinct from 'number'
     or jsonb_typeof(v_limits -> 'max_active_uploads') is distinct from 'number'
     or jsonb_typeof(v_limits -> 'stale_uploaded_minutes') is distinct from 'number' then
    return jsonb_build_object('ok', false, 'statusCode', 503, 'code', 'DOCUMENT_LIMITS_NOT_CONFIGURED');
  end if;

  v_max_documents := (v_limits ->> 'max_documents')::integer;
  v_max_pages := (v_limits ->> 'max_pages')::integer;
  v_max_text_chars := (v_limits ->> 'max_text_chars')::bigint;
  v_max_active_uploads := (v_limits ->> 'max_active_uploads')::integer;
  v_stale_uploaded_minutes := (v_limits ->> 'stale_uploaded_minutes')::integer;
  if v_max_documents < 1 or v_max_pages < 1 or v_max_text_chars < 1
     or v_max_active_uploads < 1 or v_stale_uploaded_minutes < 1 then
    return jsonb_build_object('ok', false, 'statusCode', 503, 'code', 'DOCUMENT_LIMITS_NOT_CONFIGURED');
  end if;

  -- Expire abandoned upload records before counting active uploads or documents.
  update public.documents d
     set status = 'failed',
         failed_reason = 'Upload expired before completion.'
   where d.user_id = p_user_id
     and d.status = 'uploaded'
     and d.created_at < clock_timestamp() - make_interval(mins => v_stale_uploaded_minutes);

  select count(*) into v_active
    from public.documents d
   where d.user_id = p_user_id and d.status in ('uploaded', 'processing');
  if v_active >= v_max_active_uploads then
    return jsonb_build_object('ok', false, 'statusCode', 429, 'code', 'ACTIVE_DOCUMENT_LIMIT_EXCEEDED');
  end if;

  select count(*) into v_documents
    from public.documents d
   where d.user_id = p_user_id and d.status <> 'failed';
  if v_documents >= v_max_documents then
    return jsonb_build_object('ok', false, 'statusCode', 409, 'code', 'DOCUMENT_LIMIT_EXCEEDED');
  end if;

  select count(*), coalesce(sum(char_length(dp.text)), 0)
    into v_pages, v_text_chars
    from public.document_pages dp
   where dp.user_id = p_user_id;
  if v_pages >= v_max_pages then
    return jsonb_build_object('ok', false, 'statusCode', 413, 'code', 'DOCUMENT_PAGE_LIMIT_EXCEEDED');
  end if;
  if v_text_chars >= v_max_text_chars then
    return jsonb_build_object('ok', false, 'statusCode', 413, 'code', 'DOCUMENT_TEXT_LIMIT_EXCEEDED');
  end if;

  insert into public.documents(id, user_id, title, storage_path, status, kind)
  values (p_document_id, p_user_id, btrim(p_title), p_storage_path, 'uploaded', 'other');

  return jsonb_build_object('ok', true, 'documentId', p_document_id);
end;
$function$;

revoke all on function public.create_document_upload_record(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_document_upload_record(uuid, uuid, text, text)
  to service_role;

create function private.enforce_document_page_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_plan text;
  v_limits jsonb;
  v_max_pages bigint;
  v_max_text_chars bigint;
  v_pages bigint;
  v_text_chars bigint;
begin
  -- Serialize page writes across all of one user's documents to prevent concurrent quota races.
  select p.plan into v_plan
    from public.profiles p
   where p.id = new.user_id
   for update;
  if not found then
    raise exception 'DOCUMENT_LIMITS_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  select c.value -> v_plan into v_limits
    from public.app_config c
   where c.key = 'document_limits';
  if v_limits is null
     or jsonb_typeof(v_limits -> 'max_pages') is distinct from 'number'
     or jsonb_typeof(v_limits -> 'max_text_chars') is distinct from 'number' then
    raise exception 'DOCUMENT_LIMITS_NOT_CONFIGURED' using errcode = 'P0001';
  end if;
  v_max_pages := (v_limits ->> 'max_pages')::bigint;
  v_max_text_chars := (v_limits ->> 'max_text_chars')::bigint;
  if v_max_pages < 1 or v_max_text_chars < 1 then
    raise exception 'DOCUMENT_LIMITS_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  select count(*), coalesce(sum(char_length(dp.text)), 0)
    into v_pages, v_text_chars
    from public.document_pages dp
   where dp.user_id = new.user_id
     and dp.id <> new.id
     and not (dp.document_id = new.document_id and dp.page_no = new.page_no);

  if v_pages + 1 > v_max_pages then
    raise exception 'DOCUMENT_PAGE_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;
  if v_text_chars + char_length(coalesce(new.text, '')) > v_max_text_chars then
    raise exception 'DOCUMENT_TEXT_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

revoke all on function private.enforce_document_page_limits() from public, anon, authenticated, service_role;

create trigger document_pages_enforce_user_limits
before insert or update of text, user_id on public.document_pages
for each row execute function private.enforce_document_page_limits();
