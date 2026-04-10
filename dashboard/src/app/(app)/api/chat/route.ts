import { chat } from "@/lib/tutor";
import { getLearner, getSession, createSession, getActiveLearnerIdFromRequest } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { message, sessionId, history, turnNumber, learnerId } = body;

  if (!message) {
    return Response.json({ error: "message required" }, { status: 400 });
  }

  // Get learner — use provided ID or default to first learner
  let learner;
  if (learnerId) {
    const db = await import("@/lib/db");
    learner = (await db.getAllLearners()).find((l) => l.id === learnerId);
  }
  if (!learner) {
    learner = await getLearner(getActiveLearnerIdFromRequest(request));
  }
  if (!learner) {
    return Response.json({ error: "No learner profile found" }, { status: 404 });
  }

  // Get or create session
  let activeSessionId = sessionId;
  if (!activeSessionId) {
    const session = await createSession(learner.id, "web");
    activeSessionId = session.id;
  }

  const result = await chat(
    message,
    learner,
    activeSessionId,
    history || [],
    turnNumber || 1
  );

  return Response.json({
    response: result.response,
    analysis: result.analysis,
    sessionId: activeSessionId,
    turnNumber: result.turnNumber,
  });
}
