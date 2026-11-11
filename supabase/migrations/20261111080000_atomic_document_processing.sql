-- Atomic document processing actions: lock, verify token, and mutate in one transaction.
create or replace function public.process_document_pages_atomic(
  p_action text, p_document_id uuid, p_user_id uuid, p_processing_token timestamptz,
  p_pages jsonb, p_page_count integer, p_failure_reason text
)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare
  v_status text; v_attempts integer; v_locked_at timestamptz; v_new_token timestamptz;
  v_page_count integer; v_min_page integer; v_max_page integer; v_combined_text text;
  v_arabic_count integer; v_latin_count integer; v_language text; v_reason text;
  v_saved_pages integer;
begin
  if p_document_id is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'statusCode', 400, 'error', 'Invalid document identity.');
  end if;

  select d.status, d.attempts, d.locked_at into v_status, v_attempts, v_locked_at
  from public.documents d
  where d.id = p_document_id and d.user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'statusCode', 404, 'error', 'Document not found.');
  end if;

  if p_action = 'start' then
    if v_status not in ('uploaded', 'failed') then
      return jsonb_build_object('ok', false, 'statusCode', 409, 'error', 'This document cannot start processing in its current state.');
    end if;
    v_new_token := clock_timestamp();
    update public.documents set status = 'processing', attempts = coalesce(v_attempts, 0) + 1,
      locked_at = v_new_token, processed_at = null, page_count = null, language = null, failed_reason = null
    where id = p_document_id and user_id = p_user_id;
    delete from public.document_pages where document_id = p_document_id and user_id = p_user_id;
    return jsonb_build_object('ok', true, 'status', 'processing', 'processingToken', v_new_token);
  end if;

  if p_action = 'resume' then
    if v_status <> 'processing' then
      return jsonb_build_object('ok', false, 'statusCode', 409, 'error', 'Only an interrupted processing document can be resumed.');
    end if;
    if v_locked_at is not null and v_locked_at > clock_timestamp() - interval '30 minutes' then
      return jsonb_build_object('ok', false, 'statusCode', 409, 'error', 'Document processing is still active. Try again later.');
    end if;
    v_new_token := clock_timestamp();
    update public.documents set attempts = coalesce(v_attempts, 0) + 1, locked_at = v_new_token,
      processed_at = null, page_count = null, language = null, failed_reason = null
    where id = p_document_id and user_id = p_user_id;
    delete from public.document_pages where document_id = p_document_id and user_id = p_user_id;
    return jsonb_build_object('ok', true, 'status', 'processing', 'resumed', true, 'processingToken', v_new_token);
  end if;

  if v_status <> 'processing' then
    return jsonb_build_object('ok', false, 'statusCode', 409, 'error', 'The document is not currently processing.');
  end if;
  if p_processing_token is null or p_processing_token is distinct from v_locked_at then
    return jsonb_build_object('ok', false, 'statusCode', 409, 'error', 'This processing attempt is no longer active. Refresh and resume the document.');
  end if;

  if p_action = 'save_pages' then
    if p_pages is null or jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) < 1 or jsonb_array_length(p_pages) > 20 then
      return jsonb_build_object('ok', false, 'statusCode', 400, 'error', 'A batch must contain between 1 and 20 pages.');
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_pages) item(value)
      where jsonb_typeof(item.value) <> 'object'
        or jsonb_typeof(item.value->'pageNo') is distinct from 'number'
        or (item.value->>'pageNo')::numeric <> trunc((item.value->>'pageNo')::numeric)
        or (item.value->>'pageNo')::numeric < 1 or (item.value->>'pageNo')::numeric > 1000
        or jsonb_typeof(item.value->'text') is distinct from 'string' or length(item.value->>'text') > 18000
    ) then
      return jsonb_build_object('ok', false, 'statusCode', 400, 'error', 'A page contains invalid text or page metadata.');
    end if;
    if (select count(distinct (item.value->>'pageNo')::integer) from jsonb_array_elements(p_pages) item(value)) <> jsonb_array_length(p_pages) then
      return jsonb_build_object('ok', false, 'statusCode', 400, 'error', 'A batch cannot contain duplicate page numbers.');
    end if;
    insert into public.document_pages(document_id, user_id, page_no, text)
    select p_document_id, p_user_id, page."pageNo", page.text
    from jsonb_to_recordset(p_pages) as page("pageNo" integer, text text)
    on conflict(document_id, page_no) do update set text = excluded.text
    where public.document_pages.user_id = excluded.user_id;
    get diagnostics v_saved_pages = row_count;
    return jsonb_build_object('ok', true, 'savedPages', v_saved_pages);
  end if;

  if p_action = 'complete' then
    if p_page_count is null or p_page_count < 1 or p_page_count > 1000 then
      return jsonb_build_object('ok', false, 'statusCode', 400, 'error', 'A valid page count is required.');
    end if;
    select count(*), min(page_no), max(page_no), string_agg(text, chr(10) order by page_no)
      into v_page_count, v_min_page, v_max_page, v_combined_text
    from public.document_pages where document_id = p_document_id and user_id = p_user_id;
    if v_page_count <> p_page_count or v_min_page <> 1 or v_max_page <> p_page_count then
      return jsonb_build_object('ok', false, 'statusCode', 409, 'error', 'Some document pages are missing. Processing is not complete.');
    end if;
    if length(regexp_replace(coalesce(v_combined_text, ''), '[[:space:]]', '', 'g')) = 0 then
      update public.documents set status = 'failed',
        failed_reason = 'No selectable text was found. OCR is not available yet.',
        locked_at = null, page_count = p_page_count, processed_at = clock_timestamp()
      where id = p_document_id and user_id = p_user_id;
      return jsonb_build_object('ok', false, 'statusCode', 422,
        'error', 'No selectable text was found. OCR is not available yet.', 'code', 'no_text');
    end if;
    v_arabic_count := length(regexp_replace(v_combined_text, '[^؀-ۿ]', '', 'g'));
    v_latin_count := length(regexp_replace(v_combined_text, '[^A-Za-z]', '', 'g'));
    v_language := case when v_arabic_count > 0 and v_latin_count > 0 then 'mixed'
      when v_arabic_count > 0 then 'ar' when v_latin_count > 0 then 'en' else 'mixed' end;
    update public.documents set status = 'ready', page_count = p_page_count, language = v_language,
      processed_at = clock_timestamp(), locked_at = null, failed_reason = null
    where id = p_document_id and user_id = p_user_id;
    return jsonb_build_object('ok', true, 'status', 'ready', 'pageCount', p_page_count);
  end if;

  if p_action = 'fail' then
    v_reason := case p_failure_reason
      when 'no_text' then 'No selectable text was found. OCR is not available yet.'
      when 'password_protected' then 'This PDF is password-protected and could not be processed.'
      when 'invalid_pdf' then 'This file could not be read as a valid PDF.'
      else 'PDF text extraction did not complete. Please try again.' end;
    update public.documents set status = 'failed', failed_reason = v_reason, locked_at = null
    where id = p_document_id and user_id = p_user_id;
    return jsonb_build_object('ok', true, 'status', 'failed', 'reasonCode', coalesce(p_failure_reason, 'processing_failed'));
  end if;

  return jsonb_build_object('ok', false, 'statusCode', 400, 'error', 'Unsupported processing action.');
end;
$function$;

revoke all on function public.process_document_pages_atomic(text, uuid, uuid, timestamptz, jsonb, integer, text)
  from public, anon, authenticated;
grant execute on function public.process_document_pages_atomic(text, uuid, uuid, timestamptz, jsonb, integer, text)
  to service_role;
