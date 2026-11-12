export type CorsDecision =
  | { allowed: true; headers: Record<string, string> }
  | {
    allowed: false;
    status: 403 | 503;
    code: string;
    message: string;
    headers: Record<string, string>;
  };

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Retry-After",
  "Vary": "Origin",
};

function parseAllowedOrigins(raw: string): string[] {
  return raw.split(",").map((value) => value.trim()).filter((value) => {
    if (!value || value === "*") return false;
    try {
      const parsed = new URL(value);
      return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.origin === value;
    } catch {
      return false;
    }
  });
}

export function resolveCors(request: Request): CorsDecision {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  if (!raw.trim()) {
    return {
      allowed: false,
      status: 503,
      code: "CORS_NOT_CONFIGURED",
      message: "Cross-origin access is not configured for this service.",
      headers: BASE_HEADERS,
    };
  }

  const allowedOrigins = parseAllowedOrigins(raw);
  if (!allowedOrigins.length) {
    return {
      allowed: false,
      status: 503,
      code: "CORS_ALLOWLIST_INVALID",
      message: "The configured origin allowlist is invalid.",
      headers: BASE_HEADERS,
    };
  }

  const origin = request.headers.get("Origin");
  if (!origin) {
    return {
      allowed: false,
      status: 403,
      code: "CORS_ORIGIN_REQUIRED",
      message: "An allowed browser origin is required.",
      headers: BASE_HEADERS,
    };
  }

  if (!allowedOrigins.includes(origin)) {
    return {
      allowed: false,
      status: 403,
      code: "CORS_ORIGIN_NOT_ALLOWED",
      message: "This origin is not allowed to access the service.",
      headers: BASE_HEADERS,
    };
  }

  return {
    allowed: true,
    headers: { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin },
  };
}
