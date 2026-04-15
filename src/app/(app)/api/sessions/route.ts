import { getLearner, getSessions, getActiveLearnerIdFromRequest } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId ?? undefined);
  const sessions = learner ? await getSessions(learner.id, 100) : await getSessions(100);
  return Response.json(sessions);
}
