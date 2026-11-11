import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const endpoint = readFileSync(new URL("../supabase/functions/process-document-pages/index.ts", import.meta.url), "utf8");
const recovery = readFileSync(new URL("../src/lib/recoverDocumentProcessing.ts", import.meta.url), "utf8");
const library = readFileSync(new URL("../src/components/DocumentLibrary.tsx", import.meta.url), "utf8");

test("recovery is limited to stale processing locks and uses compare-and-swap", () => {
  assert.match(endpoint, /STALE_PROCESSING_MS = 30 \* 60 \* 1000/);
  assert.match(endpoint, /action === "resume"/);
  assert.match(endpoint, /Date\.now\(\) - lockTime >= STALE_PROCESSING_MS/);
  assert.match(endpoint, /\.eq\("locked_at", lockedAt\)/);
  assert.match(endpoint, /\.is\("locked_at", null\)/);
});

test("processing attempts are fenced so an older browser cannot keep writing", () => {
  assert.match(endpoint, /body\.processingToken !== document\.locked_at/);
  assert.match(endpoint, /processingToken\s*\}\)/);
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
