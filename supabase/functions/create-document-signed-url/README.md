# create-document-signed-url

Issues a short-lived signed URL for a document owned by the authenticated user. The endpoint supports preview and recovery as well as opening a completed document.

## Security behavior

- Requires a bearer token and verifies it with Supabase Auth.
- Looks up the document with the user's JWT/RLS and requires a matching `user_id`.
- Allows only the `uploaded`, `processing`, or `ready` states. The first two are needed to preview an uploaded PDF and to recover interrupted text extraction. Failed, deleted, and unknown documents do not receive links.
- Accepts only a document UUID. It never accepts a bucket or object path from the client.
- Rechecks that the database-owned `storage_path` begins with the authenticated user's UUID plus `/`.
- Uses the service-role key only inside this Edge Function to sign an object in the fixed private `documents` bucket.
- Returns a five-minute (300-second) signed URL with `Cache-Control: no-store`.

## Required server configuration

The Supabase Edge Function runtime must provide:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not put the service-role key in frontend environment variables, source control, or client requests.

## Client contract

POST JSON:

```json
{ "documentId": "the-document-uuid" }
```

Successful response:

```json
{ "signedUrl": "https://...", "expiresIn": 300, "status": "ready" }
```

The returned `status` reflects the database state and can be `uploaded`, `processing`, or `ready`.

## Verification still required before release

Repository contract tests verify the client/server boundary and source-level security checks. Before release, test on isolated AZ-Staging with two real Auth users and the Storage API:

1. Owner can obtain a link for their own uploaded, processing, or ready document; the link opens the private PDF before expiry.
2. Another user receives 404 for that document ID.
3. Failed, deleted, or unknown documents do not receive links.
4. A database row with a path outside the user's UUID prefix is denied.
5. A link expires after five minutes.
6. Direct browser Storage access remains denied by the locked Storage policies.

No function deployment or live database change is part of this repository PR.
