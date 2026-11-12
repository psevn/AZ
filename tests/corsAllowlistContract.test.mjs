import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [helper, upload, signed, processPages, quiz] = await Promise.all([
  readFile(new URL("../supabase/functions/_shared/cors.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/create-document-upload-url/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/create-document-signed-url/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/process-document-pages/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/generate-quiz/index.ts", import.meta.url), "utf8"),
]);

test("all four Edge Functions use the same CORS allowlist helper", () => {
  for (const source of [upload, signed, processPages, quiz]) {
    assert.ok(source.includes('import { resolveCors } from "../_shared/cors.ts"'));
    assert.ok(source.includes("const cors = resolveCors(request)"));
    assert.ok(source.includes("if (!cors.allowed)"));
    assert.ok(source.includes("headers: cors.headers"));
    assert.ok(!source.includes('Access-Control-Allow-Origin": "*"'));
  }
});

test("CORS configuration is read from ALLOWED_ORIGINS and fails closed when absent or invalid", () => {
  assert.ok(helper.includes('Deno.env.get("ALLOWED_ORIGINS")'));
  assert.ok(helper.includes("CORS_NOT_CONFIGURED"));
  assert.ok(helper.includes("CORS_ALLOWLIST_INVALID"));
  assert.ok(helper.includes("CORS_ORIGIN_REQUIRED"));
  assert.ok(helper.includes("CORS_ORIGIN_NOT_ALLOWED"));
});

test("only exact HTTP(S) origins are echoed; wildcard, paths, and non-origin URLs are rejected", () => {
  assert.ok(helper.includes('value === "*"'));
  assert.ok(helper.includes("parsed.origin === value"));
  assert.ok(helper.includes('parsed.protocol === "https:"'));
  assert.ok(helper.includes('"Access-Control-Allow-Origin": origin'));
  assert.ok(helper.includes('"Vary": "Origin"'));
  assert.ok(helper.includes('"Access-Control-Expose-Headers": "Retry-After"'));
});

test("all four functions handle preflight only after the allowlist decision", () => {
  for (const source of [upload, signed, processPages, quiz]) {
    assert.ok(source.indexOf("if (!cors.allowed)") < source.indexOf('request.method === "OPTIONS"'));
  }
});
