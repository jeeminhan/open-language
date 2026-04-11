import {
  getLearner,
  getSpacedRepetitionItems,
  computeEffectiveLevel,
  getL1Patterns,
  getInterests,
  getActiveLearnerIdFromRequest,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId ?? undefined);
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const practiceItems = await getSpacedRepetitionItems(learner.id, 5);
  const effectiveLevel = await computeEffectiveLevel(learner.id);
  const l1Patterns = (await getL1Patterns(learner.id)).slice(0, 5);
  const interests = (await getInterests(learner.id)).slice(0, 10);

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
