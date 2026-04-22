import { getAuthUserId } from "@/lib/auth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

const EPHEMERAL_TOKEN_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await enforceRateLimit(userId, "voice", RATE_LIMITS.voice);
  if (blocked) return blocked;

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "LLM_API_KEY not configured" },
      { status: 500 }
    );
  }

  const nowMs = Date.now();
  const expireTime = new Date(nowMs + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(nowMs + 60 * 1000).toISOString();

  const mintRes = await fetch(
    `${EPHEMERAL_TOKEN_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uses: 1,
        expireTime,
        newSessionExpireTime,
      }),
    }
  );

  if (!mintRes.ok) {
    const body = await mintRes.text().catch(() => "");
    console.error("[gemini/token] mint failed:", mintRes.status, body);
    return Response.json(
      { error: "Failed to mint ephemeral token" },
      { status: 502 }
    );
  }

  const minted = (await mintRes.json()) as { name?: string };
  if (!minted.name) {
    return Response.json(
      { error: "Malformed ephemeral token response" },
      { status: 502 }
    );
  }

  return Response.json({ token: minted.name });
}
