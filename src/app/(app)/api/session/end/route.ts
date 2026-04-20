import { endSession, getSession, getLearner, getActiveLearnerIdFromRequest } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId);
  if (!learner) return Response.json({ error: "No learner" }, { status: 400 });

  const { sessionId } = await request.json();
  if (!sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }

  const existing = await getSession(sessionId);
  if (!existing || existing.learner_id !== learner.id) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const session = await endSession(sessionId);
  return Response.json({ session });
}
