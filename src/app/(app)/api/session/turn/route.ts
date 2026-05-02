import {
  createTurn,
  getActiveLearnerIdFromRequest,
  getLearner,
  getSession,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { enforceBodySize, BODY_LIMITS } from "@/lib/bodyLimit";

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tooLarge = enforceBodySize(request, BODY_LIMITS.textJson);
  if (tooLarge) return tooLarge;

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const turnNumber = Number.isFinite(body?.turnNumber)
    ? Number(body.turnNumber)
    : 0;
  const userMessage = typeof body?.userMessage === "string" ? body.userMessage : "";
  const tutorResponse = typeof body?.tutorResponse === "string" ? body.tutorResponse : "";

  if (!sessionId || turnNumber < 1) {
    return Response.json(
      { error: "sessionId and turnNumber required" },
      { status: 400 }
    );
  }

  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId);
  if (!learner) return Response.json({ error: "No learner found" }, { status: 404 });

  const session = await getSession(sessionId);
  if (!session || session.learner_id !== learner.id) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const turn = await createTurn(
    sessionId,
    turnNumber,
    userMessage,
    tutorResponse,
    null,
    false,
    null,
    null
  );

  return Response.json({ turn });
}
