import { getLearner, getVocabulary, getGrammar, getExpressions, getPhrasingSuggestions, getActiveLearnerIdFromRequest } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId ?? undefined);
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const vocabulary = await getVocabulary(learner.id);
  const grammar = await getGrammar(learner.id);
  const expressions = await getExpressions(learner.id);
  const suggestions = await getPhrasingSuggestions(learner.id, 50);

  return Response.json({ vocabulary, grammar, expressions, suggestions });
}
