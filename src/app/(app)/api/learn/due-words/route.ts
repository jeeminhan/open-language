import {
  getLearner,
  getDueVocab,
  getActiveLearnerIdFromRequest,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const learner = await getLearner(
    getActiveLearnerIdFromRequest(request),
    userId
  );
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const rawLimit = Number.parseInt(url.searchParams.get("limit") || "5", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 20)
    : 5;

  const vocab = await getDueVocab(learner.id, limit);

  return Response.json({
    targetLanguage: learner.target_language,
    nativeLanguage: learner.native_language,
    words: vocab.map((v) => ({
      word: v.word,
      srsState: v.srs_state,
      reviewCount: v.review_count,
    })),
  });
}
