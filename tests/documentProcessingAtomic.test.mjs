import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const endpoint = readFileSync(new URL("../supabase/functions/process-document-pages/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261111080000_atomic_document_processing.sql", import.meta.url), "utf8");

test("the authenticated edge endpoint delegates all writes to the server-only atomic RPC", () => {
  assert.match(endpoint, /auth\.getUser\(token\)/);
  assert.match(endpoint, /\.eq\("user_id", userId\)/);
  assert.match(endpoint, /rpc\("process_document_pages_atomic"/);
  assert.match(endpoint, /p_user_id: userId/);
  assert.doesNotMatch(endpoint, /\.from\("document_pages"\)/);
  assert.doesNotMatch(endpoint, /\.from\("documents"\)\s*\.update/);
});

test("each RPC action locks the owned document row before checking state or changing pages", () => {
  const lock = migration.indexOf("for update;");
  assert.ok(lock > 0);
  for (const action of ["p_action = 'start'", "p_action = 'resume'", "p_action = 'save_pages'", "p_action = 'complete'", "p_action = 'fail'"]) {
    assert.ok(migration.indexOf(action) > lock, action + " must follow the row lock");
  }
  assert.match(migration, /p_processing_token is distinct from v_locked_at/);
  assert.match(migration, /interval '30 minutes'/);
});

test("page persistence and terminal state transitions execute inside the same database transaction", () => {
  assert.match(migration, /insert into public\.document_pages/);
  assert.match(migration, /on conflict\(document_id, page_no\)/);
  assert.match(migration, /string_agg\(text, chr\(10\) order by page_no\)/);
  assert.match(migration, /set status = 'ready'/);
  assert.match(migration, /set status = 'failed'/);
});

test("the atomic RPC is invoker-only and executable only by service_role", () => {
  assert.match(migration, /security invoker/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /revoke all on function public\.process_document_pages_atomic[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.process_document_pages_atomic[\s\S]*to service_role/);
});
