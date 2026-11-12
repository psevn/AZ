-- Disposable PostgreSQL integration checks for document usage limits.
do $test$
declare
  v_user uuid := '00000000-0000-4000-8000-00000000d0c1';
  v_doc1 uuid := '00000000-0000-4000-8000-00000000d001';
  v_doc2 uuid := '00000000-0000-4000-8000-00000000d002';
  v_doc3 uuid := '00000000-0000-4000-8000-00000000d003';
  v_doc4 uuid := '00000000-0000-4000-8000-00000000d004';
  v_doc5 uuid := '00000000-0000-4000-8000-00000000d005';
  v_result jsonb;
  v_message text;
  v_config jsonb;
begin
  insert into auth.users(id, email, raw_user_meta_data)
  values (v_user, 'document-limit-test@example.invalid', '{}'::jsonb)
  on conflict (id) do nothing;
  insert into public.profiles(id, plan)
  values (v_user, 'free')
  on conflict (id) do update set plan = 'free';

  v_config := jsonb_build_object(
    'free', jsonb_build_object(
      'max_documents', 3,
      'max_pending_uploads', 1,
      'max_total_pages', 2,
      'max_total_text_chars', 10,
      'max_pages_per_document', 2,
      'stale_uploaded_minutes', 121
    ),
    'pro', jsonb_build_object(
      'max_documents', 100,
      'max_pending_uploads', 10,
      'max_total_pages', 10000,
      'max_total_text_chars', 10000000,
      'max_pages_per_document', 1000,
      'stale_uploaded_minutes', 60
    )
  );
  insert into public.app_config(key, value)
  values ('document_limits', v_config)
  on conflict (key) do update set value = excluded.value;

  v_result := public.create_document_upload_record(v_doc1, v_user, 'First', v_user::text || '/' || v_doc1::text || '.pdf');
  if v_result->>'ok' <> 'true' then raise exception 'Expected first upload reservation to succeed: %', v_result; end if;

  v_result := public.create_document_upload_record(v_doc2, v_user, 'Second', v_user::text || '/' || v_doc2::text || '.pdf');
  if v_result->>'error_code' <> 'DOCUMENT_LIMIT_PENDING_UPLOADS' then
    raise exception 'Expected pending upload cap, got %', v_result;
  end if;

  update public.documents set status = 'ready' where id = v_doc1 and user_id = v_user;
  v_result := public.create_document_upload_record(v_doc2, v_user, 'Second', v_user::text || '/' || v_doc2::text || '.pdf');
  if v_result->>'ok' <> 'true' then raise exception 'Expected second upload after pending slot release: %', v_result; end if;

  update public.documents set created_at = now() - interval '122 minutes' where id = v_doc2 and user_id = v_user;
  v_result := public.create_document_upload_record(v_doc3, v_user, 'Third', v_user::text || '/' || v_doc3::text || '.pdf');
  if v_result->>'ok' <> 'true'
     or not (coalesce(v_result->'expired_paths', '[]'::jsonb) @> jsonb_build_array(v_user::text || '/' || v_doc2::text || '.pdf'))
     or not exists (select 1 from public.documents where id = v_doc2 and status = 'failed' and failed_reason = 'Upload expired before completion.') then
    raise exception 'Expected stale uploaded row and its storage path to expire: %', v_result;
  end if;

  update public.documents set status = 'ready' where id = v_doc3 and user_id = v_user;
  update public.app_config
     set value = jsonb_set(value, '{free,max_documents}', '2'::jsonb)
   where key = 'document_limits';
  v_result := public.create_document_upload_record(v_doc4, v_user, 'Fourth', v_user::text || '/' || v_doc4::text || '.pdf');
  if v_result->>'error_code' <> 'DOCUMENT_LIMIT_DOCUMENTS' then
    raise exception 'Expected document count cap, got %', v_result;
  end if;

  update public.app_config set value = jsonb_set(value, '{free,max_documents}', '10'::jsonb)
   where key = 'document_limits';

  insert into public.document_pages(document_id, user_id, page_no, text)
  values (v_doc1, v_user, 1, '12345'), (v_doc1, v_user, 2, '67890');

  begin
    insert into public.document_pages(document_id, user_id, page_no, text)
    values (v_doc3, v_user, 1, 'x');
    raise exception 'Expected total page cap to reject the insert' using errcode = 'P0002';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_message = message_text;
    if v_message <> 'DOCUMENT_LIMIT_TOTAL_PAGES' then raise; end if;
  end;

  update public.app_config set value = jsonb_set(value, '{free,max_total_pages}', '10'::jsonb)
   where key = 'document_limits';
  begin
    insert into public.document_pages(document_id, user_id, page_no, text)
    values (v_doc3, v_user, 1, '12345678901');
    raise exception 'Expected total text limit to reject the insert' using errcode = 'P0002';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_message = message_text;
    if v_message <> 'DOCUMENT_LIMIT_TOTAL_TEXT_CHARS' then raise; end if;
  end;

  update public.app_config set value = jsonb_set(value, '{free,max_total_text_chars}', '100'::jsonb)
   where key = 'document_limits';
  begin
    insert into public.document_pages(document_id, user_id, page_no, text)
    values (v_doc1, v_user, 3, 'x');
    raise exception 'Expected per-document page limit to reject the insert' using errcode = 'P0002';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_message = message_text;
    if v_message <> 'DOCUMENT_LIMIT_PER_DOCUMENT_PAGES' then raise; end if;
  end;

  update public.app_config set value = jsonb_set(value, '{free,max_pages_per_document}', '5'::jsonb)
   where key = 'document_limits';
  update public.app_config set value = jsonb_set(value, '{free,max_total_pages}', '2'::jsonb)
   where key = 'document_limits';
  begin
    insert into public.document_pages(document_id, user_id, page_no, text)
    values (v_doc3, v_user, 1, 'x');
    raise exception 'Expected aggregate page limit to reject the insert' using errcode = 'P0002';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_message = message_text;
    if v_message <> 'DOCUMENT_LIMIT_TOTAL_PAGES' then raise; end if;
  end;

  delete from public.app_config where key = 'document_limits';
  v_result := public.create_document_upload_record(v_doc5, v_user, 'Fifth', v_user::text || '/' || v_doc5::text || '.pdf');
  if v_result->>'error_code' <> 'DOCUMENT_LIMIT_CONFIGURATION_MISSING' then
    raise exception 'Missing document limit configuration must fail closed: %', v_result;
  end if;

  raise notice 'PASS: document count, pending uploads, stale expiry, aggregate pages/text, per-document pages, and fail-closed configuration';
end;
$test$;
