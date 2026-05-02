import {
  createSession,
  getActiveLearnerIdFromRequest,
  getLearner,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { enforceBodySize, BODY_LIMITS } from "@/lib/bodyLimit";

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tooLarge = enforceBodySize(request, BODY_LIMITS.textJson);
  if (tooLarge) return tooLarge;

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const mode = typeof body?.mode === "string" && body.mode.trim()
    ? body.mode.trim().slice(0, 40)
    : "voice-web";

  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId);
  if (!learner) return Response.json({ error: "No learner found" }, { status: 404 });

  const session = await createSession(learner.id, mode);

  return Response.json({
    sessionId: session.id,
    session,
  });
}
