export interface CachedLearner {
  id: string;
  name: string;
  native_language: string;
  target_language: string;
  proficiency_level?: string | null;
  last_session_at?: string | null;
}

const KEY = "cached_learner";

export function readCachedLearner(): CachedLearner | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLearner;
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.native_language === "string" &&
      typeof parsed.target_language === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCachedLearner(learner: CachedLearner): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(learner));
  } catch {
    // localStorage full or blocked — silent
  }
}

export function clearCachedLearner(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
