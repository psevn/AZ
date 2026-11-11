import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const endpoint = readFileSync(
  new URL("../supabase/functions/create-document-signed-url/index.ts", import.meta.url),
  "utf8",
);
const endpointReadme = readFileSync(
  new URL("../supabase/functions/create-document-signed-url/README.md", import.meta.url),
  "utf8",
);
const platformVerification = readFileSync(
  new URL("../docs/testing/SUPABASE-PLATFORM-VERIFICATION.md", import.meta.url),
  "utf8",
);
const stagingAcceptance = readFileSync(
  new URL("../docs/testing/AZ-STAGING-PDF-ACCEPTANCE.md", import.meta.url),
  "utf8",
);

test("the browser requests a signed URL by document ID and does not sign Storage objects directly", () => {
  assert.match(app, /functions\.invoke\("create-document-signed-url"/);
  assert.match(app, /body:\s*\{documentId:data\.id\}/);
  assert.doesNotMatch(app, /storage\.from\("documents"\)\.createSignedUrl/);
  assert.doesNotMatch(app, /storage_path/);
});

test("the endpoint rejects null, arrays, and primitive JSON bodies before reading documentId", () => {
  assert.match(endpoint, /const parsedBody: unknown = JSON\.parse\(rawBody\)/);
  assert.match(
    endpoint,
    /typeof parsedBody !== "object" \|\| parsedBody === null \|\| Array\.isArray\(parsedBody\)/,
  );
  assert.ok(
    endpoint.indexOf("Array.isArray(parsedBody)") < endpoint.indexOf("body = parsedBody as"),
    "the parsed JSON shape must be validated before documentId is accessed",
  );
});

test("the endpoint authenticates the bearer token with Supabase Auth", () => {
  assert.match(endpoint, /readBearerToken\(request\)/);
  assert.match(endpoint, /auth\.getUser\(token\)/);
  assert.match(endpoint, /if \(authError \|\| !authData.user\) return json\(401/);
});

test("the endpoint resolves only an owned document in an explicitly allowed state", () => {
  assert.match(endpoint, /\.from\("documents"\)/);
  assert.match(endpoint, /\.eq\("id", documentId\)/);
  assert.match(endpoint, /\.eq\("user_id", userId\)/);
  assert.match(endpoint, /\.in\("status", \["uploaded", "processing", "ready"\]\)/);
  assert.match(endpoint, /if \(!document\) return json\(404/);
});

test("the endpoint never accepts a client-supplied path or bucket and confines paths to the user", () => {
  assert.match(endpoint, /document\.storage_path\.startsWith\(\$\{userId\}\/\)/);
  assert.match(endpoint, /\.from\("documents"\)\s*\.createSignedUrl\(document\.storage_path, 300\)/);
  assert.doesNotMatch(endpoint, /body\.storagePath|body\.path|body\.bucket/);
});

test("privileged Storage signing is server-side and the link expires after five minutes", () => {
  assert.match(endpoint, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(endpoint, /Cache-Control": "no-store"/);
  assert.match(endpoint, /createSignedUrl\(document\.storage_path, 300\)/);
  assert.match(endpoint, /expiresIn: 300/);
});

test("signed URL documentation includes preview and recovery states instead of claiming ready-only access", () => {
  assert.match(endpointReadme, /uploaded[\s\S]*processing[\s\S]*ready/);
  assert.match(endpointReadme, /300-second/);
  assert.doesNotMatch(endpointReadme, /status = 'ready'/);
  assert.doesNotMatch(endpointReadme, /uploaded, processing, failed, deleted, or unknown documents do not receive links/i);
});

test("platform verification describes trusted document endpoints and keeps the Staging rollout gate explicit", () => {
  assert.match(platformVerification, /create-document-upload-url/);
  assert.match(platformVerification, /create-document-signed-url/);
  assert.match(platformVerification, /process-document-pages/);
  assert.match(platformVerification, /not yet verified on AZ-Staging/i);
  assert.doesNotMatch(platformVerification, /no trusted document signed-URL endpoint was found/i);
  assert.doesNotMatch(platformVerification, /browser-side createSignedUrl call conflicts/i);
});

test("the Staging PDF acceptance checklist requires two-user isolation and preserves the Production boundary", () => {
  assert.match(stagingAcceptance, /User A/);
  assert.match(stagingAcceptance, /User B/);
  assert.match(stagingAcceptance, /receives \*\*404\*\*/);
  assert.match(stagingAcceptance, /six minutes/);
  assert.match(stagingAcceptance, /30 minutes/);
  assert.match(stagingAcceptance, /Production remains out of scope/);
  assert.match(stagingAcceptance, /not permission to deploy functions, apply migrations/i);
});
