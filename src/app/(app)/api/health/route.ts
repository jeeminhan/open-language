import { formatHealthResult, pingDatabase } from "@/lib/health";

export const dynamic = "force-dynamic";

// Health probe — no auth required. Reports DB up/down so a paused/unreachable
// Supabase project fails loudly instead of looking like an empty account.
export async function GET(request: Request) {
  // Dev-only injection: lets the evaluator drive the DOWN path restart-free.
  // Never honored in production.
  if (
    process.env.NODE_ENV !== "production" &&
    request.headers.get("x-harness-force-db-down") === "1"
  ) {
    const { status, body } = formatHealthResult({
      ok: false,
      error: "Forced DB-down (x-harness-force-db-down)",
    });
    return Response.json(body, { status });
  }

  const probe = await pingDatabase();
  const { status, body } = formatHealthResult(probe);
  return Response.json(body, { status });
}
