# AZ-Staging PDF Acceptance Checklist

**Status:** Not run — release gate only  
**Scope:** The disposable `AZ-Staging` Supabase project; never Production  
**Purpose:** Verify the real Auth, PostgREST, private Storage, and Edge Function behavior that disposable PostgreSQL CI cannot reproduce.

This is a test plan, not permission to deploy functions, apply migrations, change Supabase settings, or modify live data. Run it only after the user has separately approved the AZ-Staging migration and function rollout. Keep the PR stack open until the user reviews it.

## 1. Preconditions

Before starting the acceptance run, the reviewer must confirm all of the following:

- [ ] The document PR stack has been reviewed and the exact commit SHAs selected for the test are recorded.
- [ ] The atomic migration has been applied to **AZ-Staging only**, after explicit approval and a read-only migration-history comparison.
- [ ] `create-document-upload-url`, the updated `create-document-signed-url`, and `process-document-pages` are deployed to AZ-Staging from the reviewed source. Confirm `verify_jwt` is enabled for each function.
- [ ] The deployed signed-URL function is the updated revision: it permits owner-scoped `uploaded`, `processing`, and `ready` documents for preview/recovery, and signs only the database-owned path in the private `documents` bucket for 300 seconds.
- [ ] The atomic RPC is executable by `service_role` only; anon/authenticated cannot execute it. The browser has no service-role credential and no direct write policy on `documents` or `document_pages`.
- [ ] Two independent, disposable Auth test accounts (User A and User B) exist. Their passwords and tokens remain private and are never added to this checklist, source control, or chat.
- [ ] The local app is configured with the AZ-Staging URL and publishable key only. Follow [AZ Staging Web Setup](AZ-STAGING-WEB-SETUP.md); never put a service-role key in a Vite environment variable.
- [ ] Test PDFs are harmless, contain no personal or confidential information, and are within the 20 MiB upload limit.

**Do not proceed** if the target project, migration history, deployed function versions, or credentials are uncertain. Do not use Production as a substitute.

## 2. Owner upload and reader flow

Use User A in the AZ-Staging web app.

- [ ] Upload a small, selectable-text PDF with at least two pages through Academic Workspace. Do not create the row or Storage object manually.
- [ ] Confirm the UI progresses through upload, extraction, saving, and finalization without exposing a service-role key or raw Storage path.
- [ ] Confirm the document reaches `ready` only after every page has been saved.
- [ ] Confirm `page_count` equals the PDF page count and `processed_at` is populated.
- [ ] Open the document in Study Reader. Visit the first, middle, and final page; confirm the corresponding extracted text appears and page navigation works.
- [ ] Confirm the original PDF remains in the private `documents` bucket and the page text is available only through the authenticated application path.

Expected result: User A sees the document as ready, with the correct page count, and can read all saved pages. A partial or missing page set must never be marked ready.

## 3. Two-user isolation

Keep the document uploaded by User A. Sign out and sign in as User B.

- [ ] User B's document library does not list User A's document.
- [ ] Requesting a signed URL for User A's document ID as User B receives **404**.
- [ ] User B cannot open User A's PDF or read User A's extracted page text.
- [ ] Repeat in the opposite direction with a harmless PDF uploaded by User B; User A must not see or open it.

Expected result: each account can see and open only its own documents. A cross-user success is a release-blocking security defect; stop the test and do not weaken RLS or ownership checks.

## 4. Signed URL behavior

As the document owner:

- [ ] Request a signed URL for an owned document in an allowed state (`uploaded`, `processing`, or `ready`). The response reports `expiresIn: 300`.
- [ ] Open the URL before expiry and confirm it returns the owner's PDF.
- [ ] Wait at least six minutes, then request the **same URL** again. It must no longer provide access.
- [ ] Confirm failed, deleted, unknown, and non-owned document IDs do not receive signed URLs.
- [ ] Confirm direct browser Storage reads and writes remain denied by the locked Storage policies; all supported access goes through the trusted functions.

Never paste a signed URL into chat, an issue, a log, or a commit. Do not add broad Storage policies to make a failed request succeed.

## 5. Scanned PDF and interrupted processing

- [ ] Upload a harmless image-only/scanned PDF. It must end in `failed` with the explicit “No selectable text was found. OCR is not available yet.” reason. It must not become `ready`.
- [ ] Start a second selectable-text PDF, then interrupt the browser workflow without manually changing database rows or timestamps.
- [ ] After its processing lock is more than 30 minutes old, return to the document library. Confirm the stale document offers Resume.
- [ ] Resume it and confirm the original PDF is retrieved through the signed-URL function, text is re-extracted, all pages are saved, and the document reaches `ready`.
- [ ] If an old browser attempt is still active, its stale save/complete/fail requests must be rejected with **409** after the new attempt takes ownership.

Do not manually edit `locked_at`, attempts, document status, or page rows in Staging to speed up this test. The disposable PostgreSQL atomic fixture separately checks early-resume denial, owner mismatch, and stale-token rejection for save, complete, and fail.

## 6. Evidence record

Record one row per test group. Use aliases such as “User A” and “User B”; do not record emails, passwords, JWTs, signed URLs, or private document contents.

| Field | Value |
|---|---|
| Environment | AZ-Staging only |
| Test date (Qatar local time) | Not run |
| Repository commit SHA | Record exact tested SHA |
| Migration version | Record applied version, or “not applied” |
| Edge Function versions | Record deployed versions |
| User A / User B | Test aliases only |
| Owner upload + reader | Not run |
| Cross-user isolation | Not run |
| Signed URL expiry | Not run |
| Scanned PDF behavior | Not run |
| Stale recovery | Not run |
| Reviewer / evidence link | Not run |

## 7. Stop conditions and release decision

Stop immediately and preserve evidence if:

- a user can list, sign, download, or read another user's document;
- a document becomes `ready` with missing pages or no selectable text;
- an old processing attempt can write after resume;
- the browser receives or references a service-role key;
- direct Storage access succeeds unexpectedly; or
- the deployed code, migration history, or project identity differs from the approved plan.

The PDF pipeline is **not accepted** until every applicable check above has a recorded result and reviewer. Passing repository tests or disposable PostgreSQL replay alone is not a Staging pass. Production remains out of scope and requires separate approval.
