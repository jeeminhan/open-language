import type {
  QuizQuestion,
  Scene,
  SceneAttempt,
  SceneCheck,
  SceneEvaluation,
  SceneItemType,
} from "./types";

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[~～]/g, "〜")
    .replace(/\s+/g, "")
    .trim();
}

function grammarNeedle(pattern: string): string {
  const normalized = normalizeForMatch(pattern).replace(/^〜/, "");
  if (normalized.includes("つもり")) return "つもり";
  if (normalized.includes("てしまう")) return "てしま";
  if (normalized.includes("たい")) return "たい";
  if (normalized.includes("ほうがいい")) return "ほうがいい";
  return normalized;
}

function textUsesTarget(
  text: string,
  target: string,
  type: SceneItemType
): boolean {
  const haystack = normalizeForMatch(text);
  const needle = type === "grammar" ? grammarNeedle(target) : normalizeForMatch(target);
  return Boolean(needle && haystack.includes(needle));
}

function scoreTextUse(text: string, target: string, type: SceneItemType): 0 | 1 | 2 | 3 {
  if (!text.trim()) return 0;
  if (!textUsesTarget(text, target, type)) return 0;
  const hasSentenceShape = /[。.!?？]$/.test(text.trim()) || text.trim().length >= 8;
  return hasSentenceShape ? 3 : 2;
}

function isQuizCorrect(question: QuizQuestion, answer: string): boolean {
  const submitted = answer.trim();
  if (!submitted) return false;
  if (question.type === "yes_no") {
    return normalizeForMatch(submitted) === normalizeForMatch(question.answer);
  }
  if (question.type === "multiple_choice") {
    return submitted === question.answer;
  }
  return textUsesTarget(submitted, question.answer, question.targetType);
}

export function evaluateSceneAttempt(scene: Scene, attempt: SceneAttempt): SceneEvaluation {
  const checks: SceneCheck[] = [];
  const drill = scene.drillPrompts[0];

  if (drill) {
    const targetText = "target" in drill.targetItem
      ? drill.targetItem.target
      : drill.targetItem.text;
    const score = scoreTextUse(attempt.drillAnswer, targetText, drill.targetItem.type);
    checks.push({
      itemType: drill.targetItem.type,
      text: targetText,
      mode: "active",
      correct: score >= 2,
      score,
      evidence: attempt.drillAnswer,
    });
  }

  const roleplayScore = scoreTextUse(
    attempt.roleplayAnswer,
    scene.focusLesson.target,
    scene.focusLesson.type
  );
  checks.push({
    itemType: scene.focusLesson.type,
    text: scene.focusLesson.target,
    mode: "active",
    correct: roleplayScore >= 2,
    score: roleplayScore,
    evidence: attempt.roleplayAnswer,
  });

  let quizCorrect = 0;
  for (const question of scene.quiz) {
    const answer = attempt.quizAnswers[question.id] ?? "";
    const correct = isQuizCorrect(question, answer);
    if (correct) quizCorrect++;
    checks.push({
      itemType: question.targetType,
      text: question.targetText,
      mode: question.recallMode,
      correct,
      score: correct ? 3 : 0,
      evidence: answer,
    });
  }

  const active = checks.filter((check) => check.mode === "active");
  const passive = checks.filter((check) => check.mode === "passive");
  const activeCorrect = active.filter((check) => check.correct).length;
  const passiveCorrect = passive.filter((check) => check.correct).length;
  const baseXp = scene.questReward.xp;
  const xpEarned = Math.max(
    10,
    Math.round(baseXp * ((activeCorrect + passiveCorrect) / Math.max(1, checks.length)))
  );

  return {
    checks,
    quizCorrect,
    quizTotal: scene.quiz.length,
    activeCorrect,
    activeTotal: active.length,
    passiveCorrect,
    passiveTotal: passive.length,
    xpEarned,
  };
}
