# create-document-upload-url

Creates a short-lived Supabase Storage signed-upload token and the corresponding document row for the authenticated user.

## Security contract

- Requires a bearer token verified with Supabase Auth.
- Calls `public.create_document_upload_record` to create the document row in a transaction after locking the user's profile row and checking configured plan limits.
- Derives the only accepted storage path as `<user-id>/<document-id>.pdf`; the browser never supplies a bucket or storage path.
- Uses the service-role key only inside this Edge Function for the quota RPC, owner-scoped failure update, and signed upload token creation.
- Supports a `mark_failed` action that updates only an `uploaded` row matching both the document ID and authenticated owner.
- Returns only the document ID, path, and short-lived upload token; the browser never receives privileged credentials.
- Sends `Cache-Control: no-store` on responses.
- Supabase signed upload tokens remain valid for **2 hours** and cannot be individually revoked. Marking a document as failed does not revoke an already-issued token; any unused token expires naturally.

## Client flow

1. The browser invokes this function with a UUID and display title.
2. The function authenticates the caller, creates the owner-scoped `documents` row, and creates a signed upload token.
3. The browser uploads using `storage.from("documents").uploadToSignedUrl(path, token, file)`.
4. If the upload fails after the row was created, the browser invokes the same function with `action: "mark_failed"`; the function applies an owner-scoped status update.

The browser does not write to `public.documents`. This preserves the existing read-only authenticated grant and RLS policy.

## Server-side quotas

The owner must configure `app_config.document_limits` as a JSON object keyed by plan (`free`, `pro`). Each plan entry requires positive integer values for `max_documents`, `max_pages`, `max_text_chars`, `max_active_uploads`, and `stale_uploaded_minutes`. Missing or invalid configuration fails closed. The database RPC expires old `uploaded` rows, then atomically enforces document and active-upload caps while holding the user's profile row lock. A database trigger enforces total page and extracted-text limits on every page insert/update, also serialized by that profile row. Stable errors include `DOCUMENT_LIMIT_EXCEEDED`, `ACTIVE_DOCUMENT_LIMIT_EXCEEDED`, `DOCUMENT_PAGE_LIMIT_EXCEEDED`, and `DOCUMENT_TEXT_LIMIT_EXCEEDED`.

## Limits and next phase

The browser enforces the current 20 MiB limit and PDF file selection. The private Storage bucket also enforces the 20 MiB object limit and PDF MIME type. The transactional server quota RPC and page trigger are defined in `supabase/migrations/20261112090000_document_upload_limits.sql`; the migration is review-only and must not be applied until separately approved. This upload step does not extract text or run OCR; successful uploads remain `uploaded` until a separately reviewed processing pipeline validates the PDF, extracts text/page references, and transitions it to `ready`.

## Deployment

This function is not deployed by this change. Deploy to AZ-Staging only after review and explicit approval. Do not deploy to Production as part of this PR.
