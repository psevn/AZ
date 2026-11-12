# AZ PDF Text Processing Contract

This pipeline stores selectable text extracted from a user's PDF in bounded page records. It does not perform OCR and does not call an AI provider.

## Trust boundary

- PDF bytes remain in the private `documents` Storage bucket.
- The signed-in browser downloads the original PDF through the trusted signed-URL function and extracts selectable text locally with the pinned PDF.js dependency.
- The browser sends extracted text to the authenticated `process-document-pages` Edge Function.
- The Edge Function verifies the bearer token with Supabase Auth and verifies that the document belongs to that user.
- The Edge Function delegates every processing state change and page write to `public.process_document_pages_atomic(...)`.
- The database RPC is `SECURITY INVOKER`, uses an empty `search_path`, and is executable only by `service_role`. The Edge Function is the only intended caller.
- The browser must never write directly to `documents` or `document_pages`; do not grant browser roles write access to these server-managed records.

## Processing actions

All requests are JSON POSTs with the authenticated user's bearer token.

### Start

```json
{ "action": "start", "documentId": "<uuid>" }
```

Only `uploaded` or `failed` documents can start. The atomic RPC locks the document row, increments the attempt counter, clears prior page rows, and moves the document to `processing`. The response includes a `processingToken` tied to the active lock.

### Save pages

Send batches of up to 20 pages. Page numbers are 1-based.

```json
{
  "action": "save_pages",
  "documentId": "<uuid>",
  "processingToken": "<token returned by start or resume>",
  "pages": [
    { "pageNo": 1, "text": "Extracted page text" },
    { "pageNo": 2, "text": "More extracted text" }
  ]
}
```

Limits: request body at most 400 KiB, up to 20 pages per batch, 18,000 characters per page, and 300,000 characters per batch. Page rows are upserted by `(document_id, page_no)` inside the same database transaction as the active-attempt check.

### Complete

```json
{
  "action": "complete",
  "documentId": "<uuid>",
  "processingToken": "<active token>",
  "pageCount": 2
}
```

The RPC locks the row and verifies the active token, then confirms that every page number from 1 through `pageCount` exists. Only then does it set the document to `ready`, record page count and processing time, and derive the basic Arabic/English/mixed language label.

If no non-whitespace text was extracted, the document is marked `failed` with an explicit OCR-not-available reason. Image-only PDFs are not falsely marked ready.

### Fail

```json
{
  "action": "fail",
  "documentId": "<uuid>",
  "processingToken": "<active token>",
  "reasonCode": "invalid_pdf"
}
```

Supported reason codes: `no_text`, `password_protected`, `invalid_pdf`, and `processing_failed`. Failure is also fenced by the active processing token.

## Recovery and concurrency

- A processing attempt owns the current `locked_at` token.
- A processing lock is considered stale only after 30 minutes (or when the lock is null).
- `resume` obtains the document row lock before checking staleness, replacing the token, incrementing attempts, and clearing old page rows.
- Every save, complete, and fail action checks the token under that same row lock. A tab from an older attempt receives a conflict response and cannot overwrite the resumed attempt.
- The database transaction makes page writes and state transitions atomic; there is no gap between checking the token and persisting the batch.

## Current limitations

- PDF text extraction and page numbering run in the signed-in browser using PDF.js. The server stores the submitted page text and checks that a generated question refers to a page number present in those submitted rows, but it does **not** independently re-open the original PDF bytes or verify that the submitted text/page boundary matches the original file.
- Therefore, page numbers and question source-page labels are **unverified extraction references**, not verified citations to the original PDF. They may be inaccurate if browser extraction, page ordering, or source parsing is wrong. The UI must label them as unverified and must not describe them as confirmed original-file page references.
- This pipeline extracts selectable text; it does not OCR scanned/image-only pages.
- AI summaries, flashcards, and question generation are separate work and are not part of this pipeline.
- Repository contract tests and clean PostgreSQL migration replay do not replace an end-to-end test against the AZ-Staging Supabase Auth and Storage services.
- Before release, staging verification must cover at least two users, owner-only signed URLs, private Storage access, upload, text extraction, resume fencing, page completeness, and signed URL expiry.
- No live database migration or Edge Function deployment is performed by the repository changes alone.
