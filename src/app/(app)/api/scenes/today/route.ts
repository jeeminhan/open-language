import {
  getActiveLearnerIdFromRequest,
  getDueGrammar,
  getDueVocab,
  getLearner,
  getNextCurriculumLesson,
  getSessions,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { buildScene } from "@/lib/scenes/builder";

export const dynamic = "force-dynamic";

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

  if (!learner.target_language.toLowerCase().includes("japanese")) {
    return Response.json(
      { error: "Scene mode is available for Japanese learners first." },
      { status: 400 }
    );
  }

  const [dueVocab, dueGrammar, lessonPlan, sessions] = await Promise.all([
    getDueVocab(learner.id, 8),
    getDueGrammar(learner.id, 5),
    getNextCurriculumLesson(learner, {
      scenarioId: "quest-scene",
      scenarioLabel: "Japanese mystery quest scene",
      scenarioTags: ["mystery", "plans", "travel", "everyday"],
      vocabBudget: 5,
      grammarBudget: 1,
    }),
    getSessions(learner.id, 200),
  ]);

  const completedSceneCount = sessions.filter((session) => session.mode === "scene").length;
  const scene = buildScene({
    learner,
    dueVocab,
    dueGrammar,
    lessonPlan,
    completedSceneCount,
  });

  return Response.json({
    scene,
    connection: {
      source: "next-app",
      apiVersion: 1,
      reusableByCli: true,
      resultEndpoint: "/api/scenes/result",
    },
  });
}
