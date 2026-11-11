import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const endpoint = readFileSync(
  new URL("../supabase/functions/create-document-signed-url/index.ts", import.meta.url),
  "utf8",
);

test("the browser requests a signed URL by document ID and does not sign Storage objects directly", () => {
  assert.match(app, /functions\.invoke\("create-document-signed-url"/);
  assert.match(app, /body:\s*\{documentId:data\.id\}/);
  assert.doesNotMatch(app, /storage\.from\("documents"\)\.createSignedUrl/);
  assert.doesNotMatch(app, /storage_path/);
});

test("the endpoint authenticates the bearer token with Supabase Auth", () => {
  assert.match(endpoint, /readBearerToken\(request\)/);
  assert.match(endpoint, /auth\.getUser\(token\)/);
  assert.match(endpoint, /if \(authError \|\| !authData\.user\) return json\(401/);
});

test("the endpoint resolves only a ready document owned by the authenticated user", () => {
  assert.match(endpoint, /\.from\("documents"\)/);
  assert.match(endpoint, /\.eq\("id", documentId\)/);
  assert.match(endpoint, /\.eq\("user_id", userId\)/);
  assert.match(endpoint, /\.eq\("status", "ready"\)/);
  assert.match(endpoint, /if \(!document\) return json\(404/);
});

test("the endpoint never accepts a client-supplied path or bucket and confines paths to the user", () => {
  assert.match(endpoint, /document\.storage_path\.startsWith\(\`\$\{userId\}\/\`\)/);
  assert.match(endpoint, /\.from\("documents"\)\s*\.createSignedUrl\(document\.storage_path, 300\)/);
  assert.doesNotMatch(endpoint, /body\.storagePath|body\.path|body\.bucket/);
});

test("privileged Storage signing is server-side and the link expires after five minutes", () => {
  assert.match(endpoint, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(endpoint, /Cache-Control": "no-store"/);
  assert.match(endpoint, /createSignedUrl\(document\.storage_path, 300\)/);
  assert.match(endpoint, /expiresIn: 300/);
});
