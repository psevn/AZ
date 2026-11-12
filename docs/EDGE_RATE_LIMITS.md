# Edge Function per-user rate limits

The document and quiz Edge Functions use a shared helper backed by the service-role-only `public.consume_user_rate_limit(uuid, text)` RPC. The database performs an atomic counter upsert keyed by `(user_id, endpoint, window_start)`; concurrent calls cannot increment beyond the configured maximum.

## Required owner configuration

Before deploying any of the four protected functions, configure `app_config.request_rate_limits` as a JSON object keyed by plan (`free`, `pro`). Each plan must include every endpoint below. Each entry requires integer `window_seconds` (1–86400) and `max_requests` (1–10000).

- `create_document_upload_url`
- `create_document_signed_url`
- `process_document_pages`
- `process_document_pages_save_pages`
- `generate_quiz`

Example shape (the numbers are placeholders, not recommended plan settings):

```json
{
  "free": {
    "create_document_upload_url": { "window_seconds": 60, "max_requests": 5 },
    "create_document_signed_url": { "window_seconds": 60, "max_requests": 10 },
    "process_document_pages": { "window_seconds": 60, "max_requests": 10 },
    "process_document_pages_save_pages": { "window_seconds": 60, "max_requests": 3 },
    "generate_quiz": { "window_seconds": 60, "max_requests": 2 }
  },
  "pro": {
    "create_document_upload_url": { "window_seconds": 60, "max_requests": 30 },
    "create_document_signed_url": { "window_seconds": 60, "max_requests": 60 },
    "process_document_pages": { "window_seconds": 60, "max_requests": 60 },
    "process_document_pages_save_pages": { "window_seconds": 60, "max_requests": 20 },
    "generate_quiz": { "window_seconds": 60, "max_requests": 10 }
  }
}
```

The `save_pages` action has its own bucket because it is the heaviest document-processing action. Rate-limit counters are per user and per endpoint. Expired buckets older than one day are pruned for the current user during a rate-limit check.

Missing or invalid configuration fails closed with HTTP 503. Exceeded limits return HTTP 429, a stable `RATE_LIMIT_EXCEEDED` code, a `Retry-After` header, and `retryAfterSeconds` in the response body. Do not deploy these function changes until the owner configures this object and verifies values for each plan.

The migration and concurrency checks are source-only until reviewed. The CI rate-limit integration test runs against disposable PostgreSQL; it does not configure AZ-Staging or Production.
