import {
  getActiveLearnerIdFromRequest,
  getLearner,
  getNextCurriculumLesson,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

function readTags(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
  return tags.length > 0 ? tags : undefined;
}

function readBudget(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId);
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const plan = await getNextCurriculumLesson(learner, {
    scenarioId: url.searchParams.get("scenarioId") || undefined,
    scenarioLabel: url.searchParams.get("scenarioLabel") || undefined,
    scenarioTags: readTags(url.searchParams.get("tags")),
    vocabBudget: readBudget(url.searchParams.get("vocab"), 5, 20),
    grammarBudget: readBudget(url.searchParams.get("grammar"), 1, 5),
  });

  if (!plan) {
    return Response.json({
      targetLanguage: learner.target_language,
      lesson: null,
    });
  }

  return Response.json({
    targetLanguage: learner.target_language,
    lesson: plan,
  });
}
