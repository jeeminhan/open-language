/**
 * Shared building blocks for the English → Japanese tutor prompts.
 *
 * Everything in this folder hardcodes Japanese as the target language and
 * English as the native fallback. When porting to a new target language,
 * copy this folder to `src/lib/prompts/<lang>/` and adapt the strings.
 *
 * Three call sites consume these:
 *   - `call.ts`        → live voice tutor (drill / role-play / lesson modes)
 *   - `levelTest.ts`   → first-call CEFR assessment (voice)
 *   - `chat.ts`        → text chat tutor with SRS bookkeeping + analysis tags
 *
 * The shared style / language / mode pieces live here so all three
 * surfaces stay pedagogically consistent.
 */

export const TARGET_LANGUAGE = "Japanese";
export const NATIVE_LANGUAGE = "English";

/**
 * Universal language directives. Both voice and text tutors should obey these.
 */
export const LANGUAGE_RULES = [
  `LANGUAGE`,
  `- Speak ${TARGET_LANGUAGE}. Drop into ${NATIVE_LANGUAGE} only when the learner is truly stuck.`,
  `- Always interpret the learner's voice as ${TARGET_LANGUAGE}, even with imperfect pronunciation.`,
].join("\n");

/**
 * Voice-call style: short, warm, conversational. No lectures, no narration.
 */
export const VOICE_STYLE_RULES = [
  `STYLE`,
  `- Reply in 1–2 short sentences. Never lecture.`,
  `- This is a phone call. Be warm and human. No narration like "I will now do X".`,
  `- Don't announce mode switches. Just adopt the right behavior silently.`,
].join("\n");

/**
 * Default proficiency level when the learner hasn't been assessed yet.
 */
export const DEFAULT_LEVEL = "A2";

export function levelLabel(level: string | null | undefined): string {
  return level && level.trim().length > 0 ? level : DEFAULT_LEVEL;
}

/**
 * Drill-mode body for the voice prompt. Returns either the active drill
 * instructions or a graceful fallback if no words are queued.
 */
export function drillModeBlock(drillWords: ReadonlyArray<string>): string {
  if (drillWords.length === 0) {
    return [
      `## DRILL MODE`,
      `If they ask for drill but no words are queued, gently suggest in ${TARGET_LANGUAGE} that they have a conversation first to build their vocabulary. Then transition into role-play.`,
    ].join("\n");
  }

  const numbered = drillWords.map((w, i) => `  ${i + 1}. ${w}`).join("\n");
  return [
    `## DRILL MODE`,
    `If they say "drill" / "vocab" / "words" / similar:`,
    `- Drill these words in order, one at a time:`,
    numbered,
    `- Ask them to use the current word in a ${TARGET_LANGUAGE} sentence.`,
    `- React with ONE short ${TARGET_LANGUAGE} sentence after each attempt (encouragement OR a tiny correction).`,
    `- Move to the next word once they've used the current one correctly. If they're wrong, invite them to try the SAME word again.`,
    `- After the last word, congratulate them warmly in one short ${TARGET_LANGUAGE} sentence.`,
    `- Don't lecture. Don't explain grammar. Don't change word order.`,
  ].join("\n");
}

/**
 * Role-play mode body. Identical for everyone — no drill list to splice in.
 */
export const ROLEPLAY_MODE_BLOCK = [
  `## ROLE-PLAY MODE`,
  `If they want a scenario, want to chat, or their answer is open-ended:`,
  `- If they name a scenario (e.g. "ordering ramen"), play the other character (waiter, etc.).`,
  `- If they say "just chat" or anything ambiguous, treat it as a casual phone call — ask about their day, share a small story, etc.`,
  `- Stay in character / stay in ${TARGET_LANGUAGE}.`,
  `- React warmly, recast errors (repeat them correctly), end every turn with a question to keep them talking.`,
].join("\n");

/**
 * Lesson mode body for the voice prompt.
 */
export const LESSON_MODE_BLOCK = [
  `## LESSON MODE`,
  `If they want a lesson on a specific topic (a grammar point, an expression, a kanji):`,
  `- Briefly state the rule in 1–2 sentences. Use ${NATIVE_LANGUAGE} only for the rule itself if needed.`,
  `- Give 2–3 short example sentences in ${TARGET_LANGUAGE}.`,
  `- Then ask them to try one. React in 1 sentence.`,
  `- After 3–4 exchanges on the topic, transition smoothly into a short related role-play.`,
].join("\n");

/**
 * Greeting cues sent as the first user-side message to nudge the model into
 * speaking first. Hardcoded Japanese so the tutor opens in the target language
 * instead of asking "what language should we use?".
 */
export const GREETING_FIRST_CALL = `Start the conversation. Greet the learner warmly in ${TARGET_LANGUAGE} and tell them you'll chat for a few minutes to figure out where they are. One short sentence.`;

export const GREETING_RECURRING_CALL = `Greet the learner warmly in ${TARGET_LANGUAGE} and ask what they'd like to do today. One short sentence.`;
