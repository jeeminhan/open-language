// ── Pure formatter (unit-tested, no live DB) ───────────────
//
// This module is import-safe: it pulls in NO Supabase client at load time, so
// the pure formatter can be unit-tested without env. The live client is loaded
// lazily inside `pingDatabase` only.

export interface HealthProbeResult {
  ok: boolean;
  error?: string;
  latencyMs?: number;
}

export interface HealthHttpResult {
  status: number;
  body: {
    status: "up" | "down";
    latencyMs?: number;
    error?: string;
  };
}

/**
 * Map a raw DB-ping outcome to the JSON body + HTTP status the /api/health
 * route returns. Pure: no I/O, never touches a live DB, never echoes secrets.
 * An `ok: false` result always yields a non-empty `error` string; if the caller
 * supplied none, a generic fallback is used so the field is never empty.
 */
export function formatHealthResult(result: HealthProbeResult): HealthHttpResult {
  if (result.ok) {
    return {
      status: 200,
      body: {
        status: "up",
        ...(typeof result.latencyMs === "number"
          ? { latencyMs: result.latencyMs }
          : {}),
      },
    };
  }

  return {
    status: 503,
    body: {
      status: "down",
      error:
        result.error && result.error.trim()
          ? result.error.trim()
          : "Database unreachable",
      ...(typeof result.latencyMs === "number"
        ? { latencyMs: result.latencyMs }
        : {}),
    },
  };
}

// ── Live Supabase ping (thin, not unit-tested) ─────────────

const PING_TIMEOUT_MS = 5000;

/**
 * Cheap reachability probe: a head/count query against a table guaranteed to
 * exist (`learners`), with a short timeout so a paused/unreachable project
 * fails fast instead of hanging. Returns a sanitized error message only —
 * never a connection string or key.
 */
export async function pingDatabase(): Promise<HealthProbeResult> {
  const startedAt = Date.now();
  try {
    const { supabase } = await import("./supabase");
    const { error } = await supabase
      .from("learners")
      .select("id", { count: "exact", head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(PING_TIMEOUT_MS));

    const latencyMs = Date.now() - startedAt;
    if (error) {
      return { ok: false, error: sanitizeError(error.message), latencyMs };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return {
      ok: false,
      error: sanitizeError(err instanceof Error ? err.message : String(err)),
      latencyMs: Date.now() - startedAt,
    };
  }
}

/**
 * Strip anything that could leak credentials/host material out of an error
 * message before it reaches the response body.
 */
function sanitizeError(message: string): string {
  const cleaned = message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[redacted]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]")
    .trim();
  return cleaned || "Database unreachable";
}
