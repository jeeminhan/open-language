import { supabase } from "./supabase";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: Date;
  retryAfterSec: number;
}

interface RpcResponse {
  allowed: boolean;
  count: number;
  limit: number;
  reset_at: string;
}

export async function checkRateLimit(
  userId: string,
  scope: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_user: userId,
    p_scope: scope,
    p_limit: limit,
    p_window_sec: windowSec,
  });

  // Fail-open on infra errors so a broken counter table doesn't take down the app.
  if (error || !data) {
    return {
      allowed: true,
      count: 0,
      limit,
      resetAt: new Date(Date.now() + windowSec * 1000),
      retryAfterSec: windowSec,
    };
  }

  const result = data as RpcResponse;
  const resetAt = new Date(result.reset_at);
  const retryAfterSec = Math.max(
    1,
    Math.ceil((resetAt.getTime() - Date.now()) / 1000)
  );

  return {
    allowed: result.allowed,
    count: result.count,
    limit: result.limit,
    resetAt,
    retryAfterSec,
  };
}

export interface RateLimitProfile {
  scope: string;
  limit: number;
  windowSec: number;
}

// Standard profiles shared across endpoints.
export const RATE_LIMITS = {
  // Cheap LLM calls: error analysis, topic gen, cleanup.
  standard: { limit: 60, windowSec: 60 } as const,
  // Expensive LLM calls: full-session review, audio transcription.
  expensive: { limit: 10, windowSec: 60 } as const,
} as const;

export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    {
      error: "API limit reached for your account",
      message: `You've hit the rate limit for this feature. Try again in ${result.retryAfterSec}s.`,
      retry_after_sec: result.retryAfterSec,
      limit: result.limit,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(Math.max(0, result.limit - result.count)),
        "X-RateLimit-Reset": String(Math.floor(result.resetAt.getTime() / 1000)),
      },
    }
  );
}

export async function enforceRateLimit(
  userId: string,
  scope: string,
  profile: { limit: number; windowSec: number }
): Promise<Response | null> {
  const result = await checkRateLimit(userId, scope, profile.limit, profile.windowSec);
  if (!result.allowed) return rateLimitResponse(result);
  return null;
}
