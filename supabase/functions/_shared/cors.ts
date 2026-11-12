const BASE_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export function corsForRequest(request: Request) {
  const configured = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const allowedOrigins = configured.split(",").map((origin) => origin.trim()).filter((origin) => {
    if (!origin || origin === "*") return false;
    try {
      const parsed = new URL(origin);
      return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.origin === origin;
    } catch {
      return false;
    }
  });
  const headers = new Headers(BASE_HEADERS);

  if (!allowedOrigins.length) {
    return { allowed: false, status: 503, code: "CORS_NOT_CONFIGURED", headers };
  }

  const origin = request.headers.get("Origin");
  if (!origin) return { allowed: true, status: 200, headers };

  if (!allowedOrigins.includes(origin)) {
    return { allowed: false, status: 403, code: "ORIGIN_NOT_ALLOWED", headers };
  }

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  return { allowed: true, status: 200, code: null, headers };
}
