import { chat } from "@/lib/tutor";
import { getLearner, createLearner, createSession, getActiveLearnerIdFromRequest, getAllLearners } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  const body = await request.json();
  const { message, sessionId, history, turnNumber, learnerId } = body;

  if (!message) {
    return Response.json({ error: "message required" }, { status: 400 });
  }

  // Get learner — use provided ID or default to first learner for this user
  let learner;
  if (learnerId) {
    learner = (await getAllLearners(userId ?? undefined)).find((l) => l.id === learnerId);
  }
  if (!learner) {
    learner = await getLearner(getActiveLearnerIdFromRequest(request), userId ?? undefined);
  }
  if (!learner) {
    learner = await createLearner("Learner", "English", "Korean", "A2", "moderate", userId ?? undefined);
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
