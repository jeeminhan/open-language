// Pure helpers for the level-test assessment route. Kept free of Next.js and
// network dependencies so they can be unit-tested (tests/level-assess/).

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const VALID_LEVELS = new Set<string>(["A1", "A2", "B1", "B2", "C1", "C2"]);

export function isValidLevel(value: unknown): value is CefrLevel {
  return typeof value === "string" && VALID_LEVELS.has(value);
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
