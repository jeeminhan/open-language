import { describe, expect, it } from "vitest";
import { formatHealthResult } from "@/lib/health";

describe("formatHealthResult", () => {
  it("maps ok:true to status 'up' and HTTP 200", () => {
    const result = formatHealthResult({ ok: true, latencyMs: 42 });
    expect(result.status).toBe(200);
    expect(result.body.status).toBe("up");
    expect(result.body.latencyMs).toBe(42);
    expect(result.body.error).toBeUndefined();
  });

  it("maps ok:false to status 'down', HTTP 503, with a non-empty error", () => {
    const result = formatHealthResult({ ok: false, error: "connection refused" });
    expect(result.status).toBe(503);
    expect(result.body.status).toBe("down");
    expect(typeof result.body.error).toBe("string");
    expect(result.body.error && result.body.error.length).toBeGreaterThan(0);
  });

  it("fills a fallback error when ok:false carries no error string", () => {
    const result = formatHealthResult({ ok: false });
    expect(result.status).toBe(503);
    expect(result.body.status).toBe("down");
    expect(result.body.error && result.body.error.length).toBeGreaterThan(0);
  });

  it("never leaks a Supabase URL or key in the formatted output", () => {
    const serialized = JSON.stringify(
      formatHealthResult({ ok: true, latencyMs: 10 })
    );
    const down = JSON.stringify(
      formatHealthResult({ ok: false, error: "Database unreachable" })
    );
    for (const out of [serialized, down]) {
      expect(out).not.toMatch(/postgres(?:ql)?:\/\//i);
      expect(out).not.toMatch(/supabase\.co/i);
      // No 32+ char alphanumeric token (anon/service keys, JWTs).
      expect(out).not.toMatch(/[A-Za-z0-9_-]{32,}/);
    }
  });
});
