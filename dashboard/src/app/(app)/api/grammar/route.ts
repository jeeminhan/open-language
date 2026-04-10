import { getLearner, getGrammar, getActiveLearnerIdFromRequest } from "@/lib/db";

export async function GET(request: Request) {
  const learner = getLearner(getActiveLearnerIdFromRequest(request));
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const grammar = getGrammar(learner.id);
  return Response.json(grammar);
}
