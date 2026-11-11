# create-document-upload-url

Creates a short-lived Supabase Storage signed-upload token for one pending document owned by the authenticated user.

## Security contract

- Requires a bearer token verified with Supabase Auth.
- Reads the document row using the caller's JWT and RLS.
- Requires `status = uploaded`, matching `user_id`, and the exact server-expected path `<user-id>/<document-id>.pdf`.
- Never accepts a bucket or storage path from the browser.
- Uses the service-role key only inside the Edge Function to create a signed upload token for the fixed private `documents` bucket.
- Returns only the path and one-time upload token; the browser never receives the service-role key.

## Client flow

1. The signed-in user inserts their own `documents` row under RLS with status `uploaded`.
2. The browser invokes this function with the document UUID only.
3. The browser uploads using `storage.from("documents").uploadToSignedUrl(path, token, file)`.
4. On upload failure, the client marks the owned row as `failed`.

## Limits

The browser enforces the current 20 MiB bucket limit and PDF file selection. Storage bucket configuration also enforces the 20 MiB object limit. A future processing worker must validate the actual PDF content, extract text/page references, and transition the document to `ready` or `failed`.

## Deployment

This function is not deployed by this change. Deploy to AZ-Staging only after review and explicit approval. Do not deploy to Production as part of this PR.
