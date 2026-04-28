import {
  TARGET_LANGUAGE,
  LANGUAGE_RULES,
  VOICE_STYLE_RULES,
  drillModeBlock,
  ROLEPLAY_MODE_BLOCK,
  LESSON_MODE_BLOCK,
  levelLabel,
} from "./shared";

export interface BuildCallPromptInput {
  level?: string | null;
  /** Up to 5 SRS-due words to drill if the user opts into drill mode. */
  drillWords?: ReadonlyArray<string>;
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
}: BuildCallPromptInput): string {
  const lvl = levelLabel(level);
  const hasDrill = drillWords.length > 0;

  const optionsLine = hasDrill
    ? `    1. drill the words from last time
    2. role-play a scenario
    3. take a quick lesson`
    : `    1. role-play a scenario
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
