import { getLearner, getSessions, getActiveLearnerIdFromRequest } from "@/lib/db";

export async function GET(request: Request) {
  const learner = await getLearner(getActiveLearnerIdFromRequest(request));
  const sessions = learner ? await getSessions(learner.id, 100) : await getSessions(100);
  return Response.json(sessions);
}
