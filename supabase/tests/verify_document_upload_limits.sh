#!/usr/bin/env bash
# Disposable PostgreSQL integration checks for per-user document/page/text quotas.
set -euo pipefail

if [[ -n "${PSQL_DOCKER_CONTAINER:-}" ]]; then
  psql_run() {
    docker exec "$PSQL_DOCKER_CONTAINER" psql -U postgres -d az_clean_replay -X -v ON_ERROR_STOP=1 -At -c "$1"
  }
else
  : "${DATABASE_URL:?Set DATABASE_URL to a disposable local PostgreSQL database}"
  psql_run() { psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -c "$1"; }
fi

USER_ID="a2222222-2222-4222-8222-222222222222"
DOC_ONE="b1111111-1111-4111-8111-111111111111"
DOC_TWO="b2222222-2222-4222-8222-222222222222"
DOC_THREE="b3333333-3333-4333-8333-333333333333"

psql_run "insert into auth.users(id,email) values ('$USER_ID','document-limits-test@example.invalid') on conflict (id) do nothing;
  insert into public.profiles(id,plan) values ('$USER_ID','free')
  on conflict (id) do update set plan='free';
  insert into public.app_config(key,value) values (
    'document_limits',
    '{\"free\":{\"max_documents\":2,\"max_pages\":1,\"max_text_chars\":5,\"max_active_uploads\":1,\"stale_uploaded_minutes\":30},
      \"pro\":{\"max_documents\":2,\"max_pages\":1,\"max_text_chars\":5,\"max_active_uploads\":1,\"stale_uploaded_minutes\":30}}'::jsonb
  ) on conflict (key) do update set value=excluded.value;"

FIRST="$(psql_run "select public.create_document_upload_record('$USER_ID','$DOC_ONE','First','$USER_ID/$DOC_ONE.pdf')->>'ok';")"
if [[ "$FIRST" != "true" ]]; then echo "First document creation should succeed: $FIRST" >&2; exit 1; fi

ACTIVE="$(psql_run "select public.create_document_upload_record('$USER_ID','$DOC_TWO','Second','$USER_ID/$DOC_TWO.pdf')->>'code';")"
if [[ "$ACTIVE" != "ACTIVE_DOCUMENT_LIMIT_EXCEEDED" ]]; then echo "Expected active upload cap, got $ACTIVE" >&2; exit 1; fi

# An abandoned uploaded row is expired transactionally before the next upload is counted.
psql_run "update public.documents set created_at=now()-interval '31 minutes' where id='$DOC_ONE';"
SECOND="$(psql_run "select public.create_document_upload_record('$USER_ID','$DOC_TWO','Second','$USER_ID/$DOC_TWO.pdf')->>'ok';")"
EXPIRED="$(psql_run "select status from public.documents where id='$DOC_ONE';")"
if [[ "$SECOND" != "true" || "$EXPIRED" != "failed" ]]; then
  echo "Stale uploaded row was not expired before creating the next document." >&2
  exit 1
fi

psql_run "update public.documents set status='ready' where id='$DOC_TWO';
  insert into public.document_pages(user_id,document_id,page_no,text) values ('$USER_ID','$DOC_TWO',1,'12345');"
# Replacing an existing page must not count it twice against the page quota.
psql_run "insert into public.document_pages(user_id,document_id,page_no,text) values ('$USER_ID','$DOC_TWO',1,'abcde')
  on conflict(document_id,page_no) do update set text=excluded.text;"

PAGE_ERROR="$(psql_run "do \$\$ begin
  begin
    insert into public.document_pages(user_id,document_id,page_no,text) values ('$USER_ID','$DOC_TWO',2,'x');
    raise exception 'expected page quota failure';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'DOCUMENT_PAGE_LIMIT_EXCEEDED' then raise; end if;
  end;
end \$\$; select 'page-check-ok';" | tail -n 1)"
if [[ "$PAGE_ERROR" != "page-check-ok" ]]; then echo "Page quota trigger check failed." >&2; exit 1; fi

# Raise the page ceiling but keep the text ceiling; the second page must now fail on text.
psql_run "update public.app_config set value=jsonb_set(value,'{free,max_pages}','5'::jsonb) where key='document_limits';"
TEXT_ERROR="$(psql_run "do \$\$ begin
  begin
    insert into public.document_pages(user_id,document_id,page_no,text) values ('$USER_ID','$DOC_TWO',2,'x');
    raise exception 'expected text quota failure';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'DOCUMENT_TEXT_LIMIT_EXCEEDED' then raise; end if;
  end;
end \$\$; select 'text-check-ok';" | tail -n 1)"
if [[ "$TEXT_ERROR" != "text-check-ok" ]]; then echo "Text quota trigger check failed." >&2; exit 1; fi

# Upload creation also rejects already-consumed page/text quotas with stable error codes.
PAGE_CODE="$(psql_run "update public.app_config set value=jsonb_set(value,'{free,max_pages}','1'::jsonb) where key='document_limits';
  select public.create_document_upload_record('$USER_ID','$DOC_THREE','Third','$USER_ID/$DOC_THREE.pdf')->>'code';" | tail -n 1)"
if [[ "$PAGE_CODE" != "DOCUMENT_PAGE_LIMIT_EXCEEDED" ]]; then echo "Expected page limit code, got $PAGE_CODE" >&2; exit 1; fi

TEXT_CODE="$(psql_run "update public.app_config set value=jsonb_set(value,'{free,max_pages}','5'::jsonb) where key='document_limits';
  select public.create_document_upload_record('$USER_ID','$DOC_THREE','Third','$USER_ID/$DOC_THREE.pdf')->>'code';" | tail -n 1)"
if [[ "$TEXT_CODE" != "DOCUMENT_TEXT_LIMIT_EXCEEDED" ]]; then echo "Expected text limit code, got $TEXT_CODE" >&2; exit 1; fi

DOC_CODE="$(psql_run "update public.app_config set value=jsonb_set(value,'{free,max_text_chars}','10'::jsonb) where key='document_limits';
  update public.app_config set value=jsonb_set(value,'{free,max_documents}','1'::jsonb) where key='document_limits';
  select public.create_document_upload_record('$USER_ID','$DOC_THREE','Third','$USER_ID/$DOC_THREE.pdf')->>'code';" | tail -n 1)"
if [[ "$DOC_CODE" != "DOCUMENT_LIMIT_EXCEEDED" ]]; then echo "Expected document limit code, got $DOC_CODE" >&2; exit 1; fi

echo "PASS: transactional document/active-upload caps, stale uploaded expiry, total page/text trigger limits, upsert accounting, and stable error codes."
