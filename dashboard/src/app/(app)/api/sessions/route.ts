import { getLearner, getSessions, getActiveLearnerIdFromRequest } from "@/lib/db";

export async function GET(request: Request) {
  const learner = getLearner(getActiveLearnerIdFromRequest(request));
  const sessions = learner ? getSessions(learner.id, 100) : getSessions(100);
  return Response.json(sessions);
}
