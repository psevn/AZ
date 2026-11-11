import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const endpoint = readFileSync(new URL("../supabase/functions/process-document-pages/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261111080000_atomic_document_processing.sql", import.meta.url), "utf8");
const recovery = readFileSync(new URL("../src/lib/recoverDocumentProcessing.ts", import.meta.url), "utf8");
const library = readFileSync(new URL("../src/components/DocumentLibrary.tsx", import.meta.url), "utf8");

test("recovery is limited to stale processing locks and is checked under a database row lock", () => {
  assert.match(endpoint, /action !== "resume"/);
  assert.match(migration, /p_action = 'resume'/);
  assert.match(migration, /for update;/);
  assert.match(migration, /interval '30 minutes'/);
  assert.match(migration, /v_locked_at > clock_timestamp\(\) - interval '30 minutes'/);
});

test("processing attempts are fenced atomically before writes and terminal transitions", () => {
  assert.match(migration, /p_processing_token is distinct from v_locked_at/);
  assert.match(migration, /insert into public\.document_pages/);
  assert.match(migration, /set status = 'ready'/);
  assert.match(migration, /set status = 'failed'/);
  assert.match(endpoint, /rpc\("process_document_pages_atomic"/);
  assert.match(recovery, /processingToken/);
  assert.match(recovery, /action: "save_pages"/);
  assert.match(recovery, /action: "complete"/);
});

test("recovery fetches the original PDF through the signed URL service", () => {
  assert.match(recovery, /create-document-signed-url/);
  assert.match(recovery, /fetch\(signed\.signedUrl\)/);
  assert.match(recovery, /action: status === "uploaded" \? "start" : "resume"/);
  assert.match(recovery, /extractPdfPages/);
});

test("the library only exposes recovery for uploaded or stale processing documents", () => {
  assert.match(library, /document\.status === "uploaded"/);
  assert.match(library, /Date\.now\(\) - lockTime >= 30 \* 60 \* 1000/);
  assert.match(library, /recoverDocumentProcessing\(document\.id, document\.title/);
});
