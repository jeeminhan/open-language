import { getLearner, getStats, getErrors, getSessions, getActiveLearnerIdFromRequest } from "@/lib/db";

export async function GET(request: Request) {
  const learner = await getLearner(getActiveLearnerIdFromRequest(request));
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const stats = await getStats(learner.id);
  const errors = (await getErrors(learner.id)).slice(0, 5);
  const sessions = await getSessions(learner.id, 5);

  return Response.json({
    learner,
    stats,
    topErrors: errors,
    recentSessions: sessions,
  });
}
