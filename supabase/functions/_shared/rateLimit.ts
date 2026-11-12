export async function checkUserRateLimit(
  adminClient: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> },
  userId: string,
  endpoint: string,
): Promise<
  | { allowed: true }
  | { allowed: false; status: 429 | 503; code: string; message: string; retryAfterSeconds?: number }
> {
  const { data, error } = await adminClient.rpc("consume_edge_rate_limit", {
    p_user_id: userId,
    p_endpoint: endpoint,
  });
  if (error) {
    return {
      allowed: false,
      status: 503,
      code: "RATE_LIMIT_SERVICE_UNAVAILABLE",
      message: "Request protection is temporarily unavailable. Please try again.",
    };
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (result && typeof result === "object" && (result as Record<string, unknown>).allowed === true) {
    return { allowed: true };
  }
  const row = result && typeof result === "object" ? result as Record<string, unknown> : {};
  if (row.code === "RATE_LIMIT_EXCEEDED") {
    const retryAfterSeconds = typeof row.retryAfterSeconds === "number" && Number.isFinite(row.retryAfterSeconds)
      ? Math.max(1, Math.ceil(row.retryAfterSeconds))
      : undefined;
    return {
      allowed: false,
      status: 429,
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please wait before trying again.",
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    };
  }
  return {
    allowed: false,
    status: 503,
    code: typeof row.code === "string" ? row.code : "RATE_LIMITS_NOT_CONFIGURED",
    message: "Request limits are not configured. Please try again later.",
  };
}
