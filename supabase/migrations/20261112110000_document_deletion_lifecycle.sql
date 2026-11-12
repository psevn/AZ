-- Retry-safe individual document deletion.
-- Storage cleanup is performed by a trusted Edge Function; never delete storage.objects via SQL.

alter table public.documents
  add column upload_token_expires_at timestamptz;

-- Existing upload tokens may still be valid for up to two hours after their
-- document row was created. Backfill conservatively, then apply a five-minute
-- clock-skew/in-flight-request margin in the completion RPC.
update public.documents
   set upload_token_expires_at = created_at + interval '2 hours'
 where upload_token_expires_at is null;

alter table public.documents
  drop constraint if exists documents_status_check,
  add constraint documents_status_check
    check (status in ('uploaded', 'processing', 'ready', 'failed', 'deleting'));

create function public.begin_document_deletion(
  p_document_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_document record;
begin
  if p_document_id is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'statusCode', 400, 'code', 'INVALID_DOCUMENT_INPUT');
  end if;

  select d.id, d.user_id, d.storage_path, d.status, d.upload_token_expires_at
    into v_document
    from public.documents d
   where d.id = p_document_id
     and d.user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'statusCode', 404, 'code', 'DOCUMENT_NOT_FOUND');
  end if;

  if v_document.storage_path is distinct from
      (p_user_id::text || '/' || p_document_id::text || '.pdf') then
    return jsonb_build_object('ok', false, 'statusCode', 409, 'code', 'DOCUMENT_PATH_INVALID');
  end if;

  if v_document.status <> 'deleting' then
    update public.documents
       set status = 'deleting',
           locked_at = null
     where id = p_document_id
       and user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'deleting',
    'storagePath', v_document.storage_path,
    'uploadTokenExpiresAt', v_document.upload_token_expires_at
  );
end;
$function$;

create function public.complete_document_deletion(
  p_document_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_status text;
  v_upload_expires_at timestamptz;
  v_deleted_id uuid;
begin
  if p_document_id is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'statusCode', 400, 'code', 'INVALID_DOCUMENT_INPUT');
  end if;

  select d.status, d.upload_token_expires_at
    into v_status, v_upload_expires_at
    from public.documents d
   where d.id = p_document_id
     and d.user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('ok', true, 'alreadyDeleted', true);
  end if;

  if v_status <> 'deleting' then
    return jsonb_build_object('ok', false, 'statusCode', 409, 'code', 'DOCUMENT_NOT_DELETING');
  end if;

  if v_upload_expires_at is not null
     and v_upload_expires_at + interval '5 minutes' > clock_timestamp() then
    return jsonb_build_object(
      'ok', false,
      'statusCode', 409,
      'code', 'UPLOAD_TOKEN_WINDOW_ACTIVE'
    );
  end if;

  delete from public.documents d
   where d.id = p_document_id
     and d.user_id = p_user_id
     and d.status = 'deleting'
  returning d.id into v_deleted_id;

  return jsonb_build_object('ok', true, 'deleted', v_deleted_id is not null);
end;
$function$;

create function public.record_document_upload_token_expiry(
  p_document_id uuid,
  p_user_id uuid,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_updated_id uuid;
begin
  if p_document_id is null or p_user_id is null or p_expires_at is null
     or p_expires_at <= clock_timestamp() then
    return jsonb_build_object('ok', false, 'statusCode', 400, 'code', 'INVALID_UPLOAD_EXPIRY');
  end if;

  -- Concurrent token issuances must preserve the latest expiry, regardless of
  -- which request reaches PostgreSQL last.
  update public.documents d
     set upload_token_expires_at = greatest(
       coalesce(d.upload_token_expires_at, '-infinity'::timestamptz),
       p_expires_at
     )
   where d.id = p_document_id
     and d.user_id = p_user_id
     and d.status = 'uploaded'
  returning d.id into v_updated_id;

  if v_updated_id is null then
    return jsonb_build_object('ok', false, 'statusCode', 409, 'code', 'DOCUMENT_STATE_CHANGED');
  end if;

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.begin_document_deletion(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_document_deletion(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.record_document_upload_token_expiry(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.begin_document_deletion(uuid, uuid)
  to service_role;
grant execute on function public.complete_document_deletion(uuid, uuid)
  to service_role;
grant execute on function public.record_document_upload_token_expiry(uuid, uuid, timestamptz)
  to service_role;
