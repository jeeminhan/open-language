import {
  TARGET_LANGUAGE,
  LANGUAGE_RULES,
  VOICE_STYLE_RULES,
  drillModeBlock,
  ROLEPLAY_MODE_BLOCK,
  LESSON_MODE_BLOCK,
  levelLabel,
} from "./shared";
import {
  hasPickedCurriculum,
  type CurriculumLessonPlan,
} from "@/lib/curriculum/types";

export interface BuildCallPromptInput {
  level?: string | null;
  /** Up to 5 SRS-due words to drill if the user opts into drill mode. */
  drillWords?: ReadonlyArray<string>;
  /** Picker output for today's scenario-driven lesson. */
  curriculumLesson?: CurriculumLessonPlan | null;
}

function formatCurriculumLesson(plan: CurriculumLessonPlan | null | undefined): string {
  if (!hasPickedCurriculum(plan)) return "";
  const vocab = plan.vocab
    .map((item) => {
      const rank = item.frequencyRank ? `#${item.frequencyRank}` : "unranked";
      const reading = item.primaryReading ? ` (${item.primaryReading})` : "";
      return `  - ${item.headword}${reading} · ${rank}: ${item.gloss}`;
    })
    .join("\n");
  const grammar = plan.grammar
    .map((item) => `  - ${item.name} · ${item.jlptLevel}: ${item.gloss}`)
    .join("\n");

  return [
    `TODAY'S CURRICULUM`,
    `- Active scene: ${plan.scenarioLabel}.`,
    `- These items were picked by the curriculum engine. Prefer them over improvised lesson content.`,
    `- Teach each item briefly, then make it appear naturally inside the role-play scene.`,
    `- If the learner chooses a different scenario, adapt the items only where they still feel natural.`,
    vocab ? `- Vocab:\n${vocab}` : ``,
    grammar ? `- Grammar:\n${grammar}` : ``,
  ].filter(Boolean).join("\n");
}

/**
 * Single multi-mode system prompt for the live voice tutor. The tutor opens
 * by asking what the learner wants to do, then commits to drill / role-play
 * / guided based on the first answer. The client-side agenda router classifies
 * the same input separately to morph the agenda strip — but the actual
 * conversational behavior lives here.
 */
export function buildCallPrompt({
  level,
  drillWords = [],
  curriculumLesson = null,
}: BuildCallPromptInput): string {
  const lvl = levelLabel(level);
  const hasDrill = drillWords.length > 0;
  const hasCurriculum = hasPickedCurriculum(curriculumLesson);
  const roleplayOption = hasCurriculum
    ? `role-play today's ${curriculumLesson.scenarioLabel} scene`
    : `role-play a scenario`;

  const optionsLine = hasDrill
    ? `    1. drill the words from last time
    2. ${roleplayOption}
    3. take a quick lesson`
    : `    1. ${roleplayOption}
    2. take a quick lesson
    3. just chat`;

  return [
    `You are a friendly ${TARGET_LANGUAGE} tutor on a real-time phone call with a learner.`,
    ``,
    LANGUAGE_RULES,
    ``,
    `LEARNER`,
    `- Native: English`,
    `- Proficiency: ${lvl}`,
    ``,
    `OPENING`,
    `- Greet them warmly in ${TARGET_LANGUAGE} in ONE short sentence.`,
    `- Then ask which of three things they'd like to do today, in this order, in ${TARGET_LANGUAGE}:`,
    optionsLine,
    `- Phrase the question warmly but explicitly list the options so the learner knows what to choose. ONE sentence with the three options counted out.`,
    `- Example shape (adapt to ${TARGET_LANGUAGE}): "Want to drill some words, do a role-play, or take a quick lesson?"`,
    ``,
    formatCurriculumLesson(curriculumLesson),
    ``,
    `MODES (choose silently based on the learner's first reply — never announce a switch)`,
    ``,
    drillModeBlock(drillWords),
    ``,
    ROLEPLAY_MODE_BLOCK,
    ``,
    LESSON_MODE_BLOCK,
    ``,
    VOICE_STYLE_RULES,
  ].join("\n");
}
