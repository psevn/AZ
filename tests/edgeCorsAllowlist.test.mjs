import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const functions = [
  "../supabase/functions/create-document-upload-url/index.ts",
  "../supabase/functions/create-document-signed-url/index.ts",
  "../supabase/functions/process-document-pages/index.ts",
  "../supabase/functions/generate-quiz/index.ts",
];
const sources = await Promise.all(functions.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
const helper = await readFile(new URL("../supabase/functions/_shared/cors.ts", import.meta.url), "utf8");

test("all four Edge Functions use the same shared CORS allowlist helper", () => {
  for (const source of sources) {
    assert.match(source, /corsForRequest\(request\)/);
    assert.match(source, /headers: cors\.headers/);
    assert.doesNotMatch(source, /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/);
  }
});

test("CORS fails closed when ALLOWED_ORIGINS is missing or invalid", () => {
  assert.match(helper, /Deno\.env\.get\("ALLOWED_ORIGINS"\)/);
  assert.match(helper, /if \(!allowedOrigins\.length\)/);
  assert.match(helper, /CORS_NOT_CONFIGURED/);
  assert.doesNotMatch(helper, /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/);
});

test("only exact HTTP(S) origins in the comma-separated allowlist are reflected", () => {
  assert.match(helper, /configured\.split\(","\)/);
  assert.match(helper, /parsed\.origin === origin/);
  assert.match(helper, /allowedOrigins\.includes\(origin\)/);
  assert.match(helper, /ORIGIN_NOT_ALLOWED/);
  assert.match(helper, /headers\.set\("Vary", "Origin"\)/);
});

test("preflight and actual endpoint responses share the request-specific CORS headers", () => {
  for (const source of sources) {
    assert.match(source, /request\.method === "OPTIONS".*cors\.headers/);
    assert.match(source, /new Response\(JSON\.stringify\(body\), \{ status, headers: cors\.headers \}\)/);
  }
});
