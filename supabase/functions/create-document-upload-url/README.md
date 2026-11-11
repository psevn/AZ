# create-document-upload-url

Creates a short-lived Supabase Storage signed-upload token and the corresponding document row for the authenticated user.

## Security contract

- Requires a bearer token verified with Supabase Auth.
- Creates the document row server-side using the authenticated user's ID.
- Derives the only accepted storage path as `<user-id>/<document-id>.pdf`; the browser never supplies a bucket or storage path.
- Uses the service-role key only inside this Edge Function for the document insert/update and signed upload token creation.
- Supports a `mark_failed` action that updates only an `uploaded` row matching both the document ID and authenticated owner.
- Returns only the document ID, path, and short-lived upload token; the browser never receives privileged credentials.
- Sends `Cache-Control: no-store` on responses.

## Client flow

1. The browser invokes this function with a UUID and display title.
2. The function authenticates the caller, creates the owner-scoped `documents` row, and creates a signed upload token.
3. The browser uploads using `storage.from("documents").uploadToSignedUrl(path, token, file)`.
4. If the upload fails after the row was created, the browser invokes the same function with `action: "mark_failed"`; the function applies an owner-scoped status update.

The browser does not write to `public.documents`. This preserves the existing read-only authenticated grant and RLS policy.

## Limits and next phase

The browser enforces the current 20 MiB limit and PDF file selection. The private Storage bucket also enforces the 20 MiB object limit and PDF MIME type. This upload step does not extract text or run OCR; successful uploads remain `uploaded` until a separately reviewed processing pipeline validates the PDF, extracts text/page references, and transitions it to `ready`.

## Deployment

This function is not deployed by this change. Deploy to AZ-Staging only after review and explicit approval. Do not deploy to Production as part of this PR.
