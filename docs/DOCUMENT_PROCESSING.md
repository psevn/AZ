# AZ PDF Text Processing Contract

This contract persists page text extracted by the signed-in user's browser. It does not perform OCR or call an AI provider.

## Trust boundary

- PDF bytes remain in the private `documents` Storage bucket.
- Text extraction is intended to run locally in the browser using a pinned PDF parser.
- The browser sends extracted page text to `process-document-pages`.
- The function verifies the bearer token with Supabase Auth and resolves the document under the caller's JWT/RLS.
- Only the Edge Function uses the service-role key to write `document_pages` and update `documents`.
- The browser must never write directly to either server-managed table.

## Actions

All requests are JSON POSTs with the authenticated user's bearer token.

### Start

```json
{ "action": "start", "documentId": "<uuid>" }
```

Only `uploaded` or `failed` documents can start. Existing page rows are cleared, the attempt counter is incremented, and the document moves to `processing`.

### Save pages

Send batches of up to 20 pages. Page numbers are 1-based.

```json
{
  "action": "save_pages",
  "documentId": "<uuid>",
  "pages": [
    { "pageNo": 1, "text": "Extracted page text" },
    { "pageNo": 2, "text": "More extracted text" }
  ]
}
```

Limits: 400 KiB request body, 20 pages per batch, 18,000 characters per page, and 300,000 characters per batch. Re-sending a page is idempotent by `(document_id, page_no)`.

### Complete

```json
{ "action": "complete", "documentId": "<uuid>", "pageCount": 2 }
```

The function verifies that all page numbers from 1 through `pageCount` exist before setting the document to `ready`. It records page count, processing time, and a basic Arabic/English/mixed language label.

If fewer than 20 non-whitespace characters were extracted, the document is marked `failed` with an explicit OCR-not-available reason. Image-only PDFs are not falsely marked ready.

### Fail

```json
{ "action": "fail", "documentId": "<uuid>", "reasonCode": "invalid_pdf" }
```

Supported reason codes: `no_text`, `password_protected`, `invalid_pdf`, and `processing_failed`.

## Current limitations

- This endpoint stores extracted text; it does not extract the PDF itself.
- OCR for scanned/image-only PDFs is not included.
- AI summaries, flashcards, and question generation remain separate steps.
- No database migration is needed: `document_pages` and the required document metadata already exist in AZ-Staging.
