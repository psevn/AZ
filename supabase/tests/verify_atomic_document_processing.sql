-- Local disposable PostgreSQL test for the atomic document-processing RPC.
-- The transaction is rolled back so the fixture user and document never persist.
begin;

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000000641', 'atomic-document-test@example.invalid');

insert into public.documents (id, user_id, title, storage_path, status)
values (
  '00000000-0000-4000-8000-000000000642',
  '00000000-0000-4000-8000-000000000641',
  'Atomic processing test',
  '00000000-0000-4000-8000-000000000641/atomic-test.pdf',
  'uploaded'
);

set local role service_role;

do $atomic_test$
declare
  v_result jsonb;
  v_first_token timestamptz;
  v_resumed_token timestamptz;
  v_status text;
begin
  v_result := public.process_document_pages_atomic(
    'start', '00000000-0000-4000-8000-000000000642',
    '00000000-0000-4000-8000-000000000641', null, null, null, null
  );
  if v_result->>'ok' <> 'true' then
    raise exception 'Atomic start failed: %', v_result;
  end if;
  v_first_token := (v_result->>'processingToken')::timestamptz;

  v_result := public.process_document_pages_atomic(
    'resume', '00000000-0000-4000-8000-000000000642',
    '00000000-0000-4000-8000-000000000641', null, null, null, null
  );
  if v_result->>'ok' <> 'false' or (v_result->>'statusCode')::integer <> 409 then
    raise exception 'An active processing lock was reclaimed too early: %', v_result;
  end if;

  v_result := public.process_document_pages_atomic(
    'save_pages', '00000000-0000-4000-8000-000000000642',
    '00000000-0000-4000-8000-000000000643', v_first_token,
    jsonb_build_array(jsonb_build_object('pageNo', 1, 'text', 'Wrong owner attempt')), null, null
  );
  if v_result->>'ok' <> 'false' or (v_result->>'statusCode')::integer <> 404 then
    raise exception 'A mismatched owner was allowed to process the document: %', v_result;
  end if;

  update public.documents
  set locked_at = clock_timestamp() - interval '31 minutes'
  where id = '00000000-0000-4000-8000-000000000642';

  v_result := public.process_document_pages_atomic(
    'resume', '00000000-0000-4000-8000-000000000642',
    '00000000-0000-4000-8000-000000000641', null, null, null, null
  );
  if v_result->>'ok' <> 'true' then
    raise exception 'Atomic resume failed: %', v_result;
  end if;
  v_resumed_token := (v_result->>'processingToken')::timestamptz;

  v_result := public.process_document_pages_atomic(
    'save_pages', '00000000-0000-4000-8000-000000000642',
    '00000000-0000-4000-8000-000000000641', v_first_token,
    jsonb_build_array(jsonb_build_object('pageNo', 1, 'text', 'Old browser attempt')), null, null
  );
  if v_result->>'ok' <> 'false' or (v_result->>'statusCode')::integer <> 409 then
    raise exception 'Old attempt was not fenced after recovery: %', v_result;
  end if;

  v_result := public.process_document_pages_atomic(
    'complete', '00000000-0000-4000-8000-000000000642',
    '00000000-0000-4000-8000-000000000641', v_first_token, null, 1, null
  );
  if v_result->>'ok' <> 'false' or (v_result->>'statusCode')::integer <> 409 then
    raise exception 'Old attempt was allowed to complete after recovery: %', v_result;
  end if;

  v_result := public.process_document_pages_atomic(
    'fail', '00000000-0000-4000-8000-000000000642',
    '00000000-0000-4000-8000-000000000641', v_first_token, null, null, 'invalid_pdf'
  );
  if v_result->>'ok' <> 'false' or (v_result->>'statusCode')::integer <> 409 then
    raise exception 'Old attempt was allowed to fail the resumed document: %', v_result;
  end if;

  v_result := public.process_document_pages_atomic(
    'save_pages', '00000000-0000-4000-8000-000000000642', 
    '00000000-0000-4000-8000-000000000641', v_resumed_token,
    jsonb_build_array(jsonb_build_object('pageNo', 1, 'text', 'Current attempt page text')), null, null
  );
  if v_result->>'ok' <> 'true' then
    raise exception 'Current attempt page save failed: %', v_result;
  end if;

  v_result := public.process_document_pages_atomic(
    'complete', '00000000-0000-4000-8000-000000000642',
    '00000000-0000-4000-8000-000000000641', v_resumed_token, null, 1, null
  );
  if v_result->>'ok' <> 'true' then
    raise exception 'Atomic completion failed: %', v_result;
  end if;

  select status into v_status from public.documents
  where id = '00000000-0000-4000-8000-000000000642';
  if v_status <> 'ready' then
    raise exception 'Expected atomic document to become ready, got %', v_status;
  end if;
end;
$atomic_test$;

rollback;
