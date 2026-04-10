import { getLearner, getVocabulary, getGrammar, getExpressions, getPhrasingSuggestions, getActiveLearnerIdFromRequest } from "@/lib/db";

export async function GET(request: Request) {
  const learner = getLearner(getActiveLearnerIdFromRequest(request));
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const vocabulary = getVocabulary(learner.id);
  const grammar = getGrammar(learner.id);
  const expressions = getExpressions(learner.id);
  const suggestions = getPhrasingSuggestions(learner.id, 50);

  return Response.json({ vocabulary, grammar, expressions, suggestions });
}
