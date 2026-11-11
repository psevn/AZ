# process-document-pages

Authenticated Edge Function that coordinates PDF page-text processing for one document owned by the caller.

## Security boundary

- Accepts only POST requests with a valid bearer token.
- Verifies the token with Supabase Auth and resolves the document using the caller's JWT/RLS.
- Accepts a document UUID and bounded page payloads; it never accepts a bucket or Storage path.
- Uses the service-role client only to invoke `public.process_document_pages_atomic`.
- Does not directly write to `documents` or `document_pages`.
- The database RPC is `SECURITY INVOKER`, has an empty `search_path`, and grants execution only to `service_role`.
- The RPC takes a row lock and checks the processing token in the same transaction as page writes and status transitions. A stale browser attempt cannot write after a successful resume.

## Request actions

Every request includes `documentId`. The supported actions are:

- `start`: starts an uploaded/failed document and returns `processingToken`.
- `save_pages`: persists up to 20 pages using the active `processingToken`.
- `complete`: verifies sequential page coverage and marks the document ready using the active token.
- `fail`: records an allowlisted failure reason using the active token.
- `resume`: reclaims a processing lock only after 30 minutes of inactivity (or when the lock is null), rotates the token, and clears stale page rows.

Payload limits are enforced before the RPC: 400 KiB request body, 20 pages per batch, 18,000 characters per page, 300,000 characters per batch, and page numbers within the supported 1–1000 range.

See [docs/DOCUMENT_PROCESSING.md](../../../docs/DOCUMENT_PROCESSING.md) for the complete request contract and recovery behavior.

## Required server configuration

The Edge Function runtime must provide the standard Supabase URL, publishable/anon key, and service-role key. Never expose the service-role key to the browser or commit it to the repository.

## Verification before release

- Run the repository's document processing contract, recovery, atomic, and clean migration replay checks.
- Verify on isolated AZ-Staging with two real Auth users that one user cannot process or read another user's document.
- Exercise upload → start → save pages → complete and confirm the reader can fetch the saved pages.
- Interrupt an attempt, wait until the lock is stale, resume, and verify that requests with the old token receive 409.
- Test scanned/image-only PDFs: they must remain failed with the explicit OCR-unavailable reason, never be marked ready.
- Verify signed URL expiry and private Storage behavior.

No function deployment, database migration application, or live Supabase change is performed by this repository PR. Deploy only to AZ-Staging after review and explicit approval; Production is out of scope.
