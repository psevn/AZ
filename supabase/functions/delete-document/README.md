# delete-document

Authenticated, retry-safe deletion of one owned PDF document.

## Request

- Method: `POST`
- Body: `{ "documentId": "<uuid>" }`
- Authentication: valid Supabase bearer access token.
- CORS: shared exact-origin `ALLOWED_ORIGINS` allowlist.
- Rate limit: shares the existing `process_document_pages` per-user bucket.

The function derives the owner from `auth.getUser(token)`. It does not accept a user ID, Storage path, or bucket from the client.

## Lifecycle

1. `begin_document_deletion` locks the owner-scoped document row with `FOR UPDATE`, validates the canonical `{user_id}/{document_id}.pdf` path, changes status to `deleting`, and clears the processing lock.
2. The same row lock used by `process_document_pages_atomic` serializes page saves/completion against deletion. A processing request that wins first commits before deletion; one that loses sees the deleting state and is rejected.
3. If a previously issued signed upload token may still be valid, the function returns HTTP 202 with `status: deleting` and a retry delay. The row remains as a tombstone so the token cannot recreate an untracked object.
4. After the two-hour token validity window plus five minutes of clock-skew margin, the function removes the exact canonical object through the Storage API and lists the exact filename to verify absence.
5. Only after Storage absence is verified does `complete_document_deletion` delete the relational row. Foreign-key cascades remove its pages, summaries, notes, and quiz children.
6. Storage or finalization failures leave the tombstone for a later retry. A repeated call resumes the same state.

## Upload issuance race

The upload endpoint now stores `upload_token_expires_at` through a service-role RPC before returning the signed token. The RPC serializes on the document row and uses `greatest(existing_expiry, new_expiry)`, so concurrent token issuances can never shorten the recorded validity window. If deletion wins, the upload endpoint does not return the token; if token-expiry persistence wins, deletion sees the latest expiry and waits. If expiry persistence reports a transport/database error, the endpoint best-effort marks the reservation failed only when no expiry was recorded; this avoids marking a concurrent successful token issuance as failed. The signed token is never returned on that error path.

Supabase documents signed upload URLs as valid for two hours. Existing rows are backfilled conservatively from `created_at + 2 hours`; the completion RPC adds a five-minute margin.

## Response states

- `200 { status: "deleted" }`: Storage absence verified and relational deletion completed.
- `202 { status: "deleting", retryAfterSeconds }`: tombstone retained while the upload token validity window expires.
- `404`: document not found under the authenticated owner.
- `503`: Storage cleanup or finalization could not be verified; retry later.

This endpoint does not implement account deletion, scheduled retries, UI confirmation, or project ownership transfer. The caller must retry a pending/failed deletion; do not report completion on HTTP 202 or 503.

## Safety boundary

Repository-only implementation. Do not apply migrations, deploy this function, or run against AZ-Staging/Production without a separate approved rollout and two-user Storage integration test.
