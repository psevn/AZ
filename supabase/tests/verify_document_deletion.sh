#!/usr/bin/env bash
# Disposable PostgreSQL checks for retry-safe, owner-scoped document deletion.
set -euo pipefail

if [[ -n "${PSQL_DOCKER_CONTAINER:-}" ]]; then
  psql_run() {
    docker exec "$PSQL_DOCKER_CONTAINER" psql -U postgres -d az_clean_replay -X -v ON_ERROR_STOP=1 -At -c "$1"
  }
else
  : "${DATABASE_URL:?Set DATABASE_URL to a disposable local PostgreSQL database}"
  psql_run() { psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -c "$1"; }
fi

USER_ID="a4444444-4444-4444-8444-444444444444"
OTHER_USER_ID="a5555555-5555-4555-8555-555555555555"
DOC_READY="b4444444-4444-4444-8444-444444444444"
DOC_PROCESSING="b5555555-5555-4555-8555-555555555555"
DOC_PENDING="b6666666-6666-4666-8666-666666666666"

psql_run "insert into auth.users(id,email) values
  ('$USER_ID','document-delete-test@example.invalid'),
  ('$OTHER_USER_ID','document-delete-other@example.invalid')
  on conflict (id) do nothing;
  insert into public.profiles(id,plan) values
  ('$USER_ID','free'),('$OTHER_USER_ID','free')
  on conflict (id) do nothing;
  insert into public.app_config(key,value) values (
    'document_limits',
    '{\"free\":{\"max_documents\":10,\"max_pages\":50,\"max_text_chars\":100000,\"max_active_uploads\":5,\"stale_uploaded_minutes\":60},
      \"pro\":{\"max_documents\":10,\"max_pages\":50,\"max_text_chars\":100000,\"max_active_uploads\":5,\"stale_uploaded_minutes\":60}}'::jsonb
  ) on conflict (key) do update set value=excluded.value;
  insert into public.documents(id,user_id,title,storage_path,status,locked_at,upload_token_expires_at)
  values
  ('$DOC_READY','$USER_ID','Ready PDF','$USER_ID/$DOC_READY.pdf','ready',null,now()-interval '1 hour'),
  ('$DOC_PROCESSING','$USER_ID','Processing PDF','$USER_ID/$DOC_PROCESSING.pdf','processing',now(),now()-interval '1 hour'),
  ('$DOC_PENDING','$USER_ID','Pending PDF','$USER_ID/$DOC_PENDING.pdf','uploaded',null,now()+interval '1 hour');
  insert into public.document_pages(user_id,document_id,page_no,text)
  values ('$USER_ID','$DOC_READY',1,'safe test page');
  insert into public.summaries(user_id,document_id,content)
  values ('$USER_ID','$DOC_READY','safe test summary');"

WRONG_OWNER="$(psql_run "select public.begin_document_deletion('$DOC_READY','$OTHER_USER_ID')->>'code';")"
if [[ "$WRONG_OWNER" != "DOCUMENT_NOT_FOUND" ]]; then
  echo "Cross-owner deletion must appear as not found, got $WRONG_OWNER" >&2
  exit 1
fi
OWNER_STATUS="$(psql_run "select status from public.documents where id='$DOC_READY' and user_id='$USER_ID';")"
if [[ "$OWNER_STATUS" != "ready" ]]; then
  echo "Cross-owner request changed the document state." >&2
  exit 1
fi

STARTED="$(psql_run "select public.begin_document_deletion('$DOC_READY','$USER_ID')->>'status';")"
LOCK_CLEARED="$(psql_run "select (locked_at is null)::text from public.documents where id='$DOC_READY';")"
if [[ "$STARTED" != "deleting" || "$LOCK_CLEARED" != "true" ]]; then
  echo "Ready document did not transition to deleting with processing lock cleared." >&2
  exit 1
fi

PROCESSING_STARTED="$(psql_run "select public.begin_document_deletion('$DOC_PROCESSING','$USER_ID')->>'status';")"
PROCESSING_LOCK_CLEARED="$(psql_run "select (locked_at is null)::text from public.documents where id='$DOC_PROCESSING';")"
if [[ "$PROCESSING_STARTED" != "deleting" || "$PROCESSING_LOCK_CLEARED" != "true" ]]; then
  echo "Processing document did not serialize into deleting state." >&2
  exit 1
fi

# Concurrent signed-token issuance must retain the maximum expiry.
psql_run "select public.record_document_upload_token_expiry('$DOC_PENDING','$USER_ID',now()+interval '2 hours');"
psql_run "select public.record_document_upload_token_expiry('$DOC_PENDING','$USER_ID',now()+interval '1 hour');"
LATEST_EXPIRY="$(psql_run "select (upload_token_expires_at > now()+interval '110 minutes')::text from public.documents where id='$DOC_PENDING';")"
if [[ "$LATEST_EXPIRY" != "true" ]]; then
  echo "A later-committing shorter token expiry overwrote the maximum validity window." >&2
  exit 1
fi

PENDING_STARTED="$(psql_run "select public.begin_document_deletion('$DOC_PENDING','$USER_ID')->>'status';")"
PENDING_CODE="$(psql_run "select public.complete_document_deletion('$DOC_PENDING','$USER_ID')->>'code';")"
PENDING_STATUS="$(psql_run "select status from public.documents where id='$DOC_PENDING';")"
if [[ "$PENDING_STARTED" != "deleting" || "$PENDING_CODE" != "UPLOAD_TOKEN_WINDOW_ACTIVE" || "$PENDING_STATUS" != "deleting" ]]; then
  echo "A still-valid signed upload token must keep the tombstone pending." >&2
  exit 1
fi

COMPLETED="$(psql_run "select public.complete_document_deletion('$DOC_READY','$USER_ID')->>'deleted';")"
DOC_REMAINS="$(psql_run "select count(*) from public.documents where id='$DOC_READY';")"
CHILD_REMAINS="$(psql_run "select
  (select count(*) from public.document_pages where document_id='$DOC_READY') +
  (select count(*) from public.summaries where document_id='$DOC_READY');")"
if [[ "$COMPLETED" != "true" || "$DOC_REMAINS" != "0" || "$CHILD_REMAINS" != "0" ]]; then
  echo "Final deletion did not cascade to document-owned relational children." >&2
  exit 1
fi

# Simulate the upload-token expiry window ending, then verify retry and idempotent finalization.
psql_run "update public.documents set upload_token_expires_at=now()-interval '6 minutes' where id='$DOC_PENDING';"
RETRIED="$(psql_run "select public.complete_document_deletion('$DOC_PENDING','$USER_ID')->>'deleted';")"
REPLAY="$(psql_run "select public.complete_document_deletion('$DOC_PENDING','$USER_ID')->>'alreadyDeleted';")"
if [[ "$RETRIED" != "true" || "$REPLAY" != "true" ]]; then
  echo "Deletion retry did not converge idempotently." >&2
  exit 1
fi

echo "PASS: owner isolation, deleting tombstones, processing-lock clearing, upload-token wait, FK cascade, and retry-safe finalization."
