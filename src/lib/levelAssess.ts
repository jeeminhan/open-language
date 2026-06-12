// Pure helpers for the level-test assessment route. Kept free of Next.js and
// network dependencies so they can be unit-tested (tests/level-assess/).

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const CEFR_LEVELS: readonly CefrLevel[] = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
];

export const VALID_LEVELS = new Set<string>(CEFR_LEVELS);

export function isValidLevel(value: unknown): value is CefrLevel {
  return typeof value === "string" && VALID_LEVELS.has(value);
}

/** Default number of learner (user-role) exchanges before the level test ends. */
export const LEVEL_TEST_EXCHANGE_CAP = 5;

/**
 * Pure end-cap decision for the first-call level test. The call ends
 * deterministically once the learner has taken `cap` turns — no LLM end signal.
 * Kept pure so it is unit-testable without a live voice call.
 */
export function shouldEndLevelTest(
  userTurnCount: number,
  cap: number = LEVEL_TEST_EXCHANGE_CAP
): boolean {
  return userTurnCount >= cap;
}

export function parseJsonResponse(raw: string): unknown {
  // Strip markdown fences (```json ... ``` or ``` ... ```)
  let cleaned = raw.replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
  // Narrow to first { ... last } in case the model added prose around the JSON
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      // Tolerate trailing commas
      return JSON.parse(cleaned.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}"));
    } catch {
      return null;
    }
  }
}

export function hasTargetScript(s: string, lang: string): boolean {
  if (!s) return false;
  const l = lang.toLowerCase();
  if (l.includes("japanese")) return /[぀-ヿ一-鿿]/.test(s);
  if (l.includes("korean")) return /[가-힯]/.test(s);
  if (l.includes("chinese")) return /[一-鿿]/.test(s);
  if (l.includes("english")) return /[a-zA-Z]/.test(s);
  return true;
}

export interface NormalizedAssessment {
  level: CefrLevel;
  justification: string;
  seedWords: string[];
}

/** Validate a parsed LLM payload into a safe assessment, falling back field by field. */
export function normalizeAssessment(
  parsed: unknown,
  targetLanguage: string
): NormalizedAssessment {
  const p = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const level: CefrLevel = isValidLevel(p.level) ? p.level : "A2";
  const justification =
    typeof p.justification === "string" && p.justification.trim()
      ? p.justification.trim()
      : "First call complete — placing you here based on the conversation.";
  const seedWords = Array.isArray(p.seedWords)
    ? (p.seedWords as unknown[])
        .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
        .map((w) => w.trim())
        .filter((w) => hasTargetScript(w, targetLanguage))
        .slice(0, 5)
    : [];
  return { level, justification, seedWords };
}

/**
 * Build the Gemini structured-output `responseSchema` for the assessment.
 *
 * Uses the OpenAPI-3.0 subset the `generateContent` REST endpoint expects:
 * uppercase `type` names ("OBJECT" / "STRING" / "ARRAY"), an `enum` to pin the
 * level to a valid CEFR value, and `required` to force every field to appear.
 * This replaces relying on `maxOutputTokens` to bound free-form prose — the
 * model is forced to emit exactly this shape, so there is nothing to truncate.
 */
export function buildAssessmentResponseSchema() {
  return {
    type: "OBJECT",
    properties: {
      level: {
        type: "STRING",
        enum: [...CEFR_LEVELS],
        description: "CEFR level: one of A1, A2, B1, B2, C1, C2.",
      },
      justification: {
        type: "STRING",
        description:
          "One short sentence on what the learner handled well and what they didn't.",
      },
      seedWords: {
        type: "ARRAY",
        items: { type: "STRING" },
        description:
          "Up to 5 target-language words/phrases the learner did not know yet.",
      },
    },
    required: ["level", "justification", "seedWords"],
  } as const;
}

/** Payload the assess route returns to the client. */
export interface AssessmentClientPayload {
  level: CefrLevel;
  justification: string;
  seedWords: string[];
  /**
   * True when the LLM assessment could not be obtained and the level is a
   * fallback default, not a real placement. The client uses this to show an
   * honest degraded state instead of a fake confident level.
   */
  assessmentFailed: boolean;
  /** Human-readable error string when something went wrong, else null. */
  debug: string | null;
}

/**
 * Map a normalized assessment + the route's error state into the client-facing
 * payload. Kept pure so the failure-flag wiring is unit-testable.
 *
 * `assessError` non-null → the placement is a fallback: flag the failure so the
 * recap renders a degraded message rather than dressing it up as a real level.
 */
export function toClientPayload(
  assessment: NormalizedAssessment,
  assessError: string | null
): AssessmentClientPayload {
  return {
    level: assessment.level,
    justification: assessment.justification,
    seedWords: assessment.seedWords,
    assessmentFailed: assessError != null,
    debug: assessError,
  };
}
