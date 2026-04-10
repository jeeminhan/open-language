import {
  getLearner,
  getSpacedRepetitionItems,
  computeEffectiveLevel,
  getL1Patterns,
  getInterests,
  getActiveLearnerIdFromRequest,
} from "@/lib/db";

export async function GET(request: Request) {
  const learner = getLearner(getActiveLearnerIdFromRequest(request));
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const practiceItems = getSpacedRepetitionItems(learner.id, 5);
  const effectiveLevel = computeEffectiveLevel(learner.id);
  const l1Patterns = getL1Patterns(learner.id).slice(0, 5);
  const interests = getInterests(learner.id).slice(0, 10);

  return Response.json({
    practiceItems,
    effectiveLevel,
    l1Patterns,
    registeredLevel: learner.proficiency_level,
    targetLanguage: learner.target_language,
    nativeLanguage: learner.native_language,
    interests,
  });
}
