import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type UserRateLimitResult =
  | { allowed: true; remaining: number; retryAfterSeconds: number }
  | {
    allowed: false;
    status: 429 | 503;
    code: string;
    message: string;
    retryAfterSeconds: number;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function checkUserRateLimit(
  adminClient: SupabaseClient,
  userId: string,
  endpoint: string,
): Promise<UserRateLimitResult> {
  const { data, error } = await adminClient.rpc("consume_user_rate_limit", {
    p_user_id: userId,
    p_endpoint: endpoint,
  });

  if (error || !isRecord(data)) {
    console.error("User rate limit check failed:", error?.code ?? "invalid-rpc-result");
    return {
      allowed: false,
      status: 503,
      code: "RATE_LIMIT_UNAVAILABLE",
      message: "Request protection is temporarily unavailable. Please retry shortly.",
      retryAfterSeconds: 1,
    };
  }

  if (data.ok === true) {
    return {
      allowed: true,
      remaining: typeof data.remaining === "number" ? data.remaining : 0,
      retryAfterSeconds: typeof data.retry_after_seconds === "number" ? data.retry_after_seconds : 1,
    };
  }

  const code = typeof data.error_code === "string" ? data.error_code : "RATE_LIMIT_CONFIGURATION_INVALID";
  if (code === "RATE_LIMIT_EXCEEDED") {
    return {
      allowed: false,
      status: 429,
      code,
      message: "Too many requests. Please wait before trying again.",
      retryAfterSeconds: typeof data.retry_after_seconds === "number" && data.retry_after_seconds > 0
        ? Math.ceil(data.retry_after_seconds)
        : 1,
    };
  }

  return {
    allowed: false,
    status: 503,
    code,
    message: code === "RATE_LIMIT_CONFIGURATION_MISSING"
      ? "Request limits are not configured for this plan yet."
      : "Request limits are configured incorrectly or your account profile is unavailable.",
    retryAfterSeconds: 1,
  };
}
