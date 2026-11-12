# Edge Function CORS allowlist

The following Edge Functions share `supabase/functions/_shared/cors.ts`:

- `create-document-upload-url`
- `create-document-signed-url`
- `process-document-pages`
- `generate-quiz`

Each request must include an `Origin` header that exactly matches one entry in `ALLOWED_ORIGINS`. Configure that environment variable as a comma-separated list of exact origins, without paths or trailing slashes. For example, use `https://app.example.com,https://staging.example.com,http://localhost:5173` only after confirming those are the actual authorized AZ origins.

The helper never emits `Access-Control-Allow-Origin: *`; it echoes only the exact matched origin and sets `Vary: Origin`. Preflight requests receive the same allowlist decision. `Retry-After` is exposed to browser clients.

**Fail-closed behavior:** if `ALLOWED_ORIGINS` is missing/empty or contains no valid exact origins, requests receive HTTP 503. A missing or unlisted request origin receives HTTP 403. There is no permissive fallback. Configure the variable on each function before deployment; do not deploy these changes until the owner confirms the exact AZ-Staging and Production origins.
