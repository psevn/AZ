# Supabase Edge Function runtime configuration

The document and quiz Edge Functions use the shared CORS helper at supabase/functions/_shared/cors.ts.

Set the server-side ALLOWED_ORIGINS environment variable to a comma-separated list of exact browser origins, including scheme and port where applicable. Example format only:

```env
ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com,http://localhost:5173
```

- Do not include paths or trailing slashes; entries must be exact HTTP(S) origins.
- Wildcard * is rejected.
- Requests with an Origin header are accepted only when the exact origin is listed.
- An absent or invalid allowlist fails closed with HTTP 503 (CORS_NOT_CONFIGURED).
- A browser origin not in the allowlist receives HTTP 403 (ORIGIN_NOT_ALLOWED).
- Preflight and JSON responses use the same request-specific CORS headers.

This documents the required setting; it does not set any Supabase secret or environment variable. Configure it only after the Edge Function stack is reviewed and a separate staging configuration change is approved. No deployment is authorized by this document.
