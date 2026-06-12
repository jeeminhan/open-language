import {
  createSession,
  endSession,
  getActiveLearnerIdFromRequest,
  getLearner,
  recordGrammarReview,
  recordVocabReview,
  setSessionCounters,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import type { SceneCheck, SceneItemType } from "@/lib/scenes/types";

export const dynamic = "force-dynamic";

interface SceneResultBody {
  sceneId?: unknown;
  sceneTitle?: unknown;
  checks?: unknown;
  xpEarned?: unknown;
  quizCorrect?: unknown;
  quizTotal?: unknown;
  clueNumber?: unknown;
  totalClues?: unknown;
}

function isSceneItemType(value: unknown): value is SceneItemType {
  return value === "vocab" || value === "grammar";
}

function normalizeChecks(value: unknown): SceneCheck[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Partial<SceneCheck>;
    if (!isSceneItemType(item.itemType)) return [];
    if (typeof item.text !== "string" || !item.text.trim()) return [];
    return [{
      itemType: item.itemType,
      text: item.text.trim().slice(0, 120),
      mode: item.mode === "passive" ? "passive" : "active",
      correct: item.correct === true,
      score:
        item.score === 0 || item.score === 1 || item.score === 2 || item.score === 3
          ? item.score
          : item.correct === true
            ? 3
            : 0,
      evidence: typeof item.evidence === "string" ? item.evidence.slice(0, 500) : "",
    }];
  });
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function POST(request: Request) {
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

  const body = (await request.json()) as SceneResultBody;
  const sceneTitle = typeof body.sceneTitle === "string"
    ? body.sceneTitle.slice(0, 120)
    : "Japanese scene";
  const checks = normalizeChecks(body.checks);
  if (checks.length === 0) {
    return Response.json({ error: "No review checks supplied" }, { status: 400 });
  }

  for (const check of checks) {
    if (check.itemType === "grammar") {
      await recordGrammarReview(
        learner.id,
        check.text,
        check.correct,
        check.evidence || sceneTitle
      );
    } else {
      await recordVocabReview(learner.id, check.text, check.correct);
    }
  }

  const incorrect = checks.filter((check) => !check.correct).length;
  const session = await createSession(learner.id, "scene");
  await setSessionCounters(session.id, {
    totalTurns: Math.max(1, checks.length),
    errorsDetected: incorrect,
    correctionsGiven: checks.length - incorrect,
  });
  await endSession(
    session.id,
    `${sceneTitle}: ${checks.length - incorrect}/${checks.length} recall checks passed`
  );

  return Response.json({
    ok: true,
    sessionId: session.id,
    xpEarned: asNumber(body.xpEarned, 0),
    quizCorrect: asNumber(body.quizCorrect, 0),
    quizTotal: asNumber(body.quizTotal, 0),
    clueNumber: asNumber(body.clueNumber, 1),
    totalClues: asNumber(body.totalClues, 10),
    checksRecorded: checks.length,
  });
}
