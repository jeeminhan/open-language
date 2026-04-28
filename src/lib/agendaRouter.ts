import type { AgendaKind } from "@/components/AgendaStrip";

export type DetectedAgenda = Exclude<AgendaKind, "listening">;

// Match in either the learner's native English OR the target language.
// Voice STT is configured for the target language, so a learner saying
// English keywords often comes back as target-language transliteration —
// scanning both gives us a much better hit rate.

const DRILL_PATTERNS: RegExp[] = [
  // English
  /\bdrill\b/i,
  /\bdrills\b/i,
  /\bdrilling\b/i,
  /\bvocab\b/i,
  /\bvocabulary\b/i,
  /\b(review|practice)\s+words?\b/i,
  /\bsrs\b/i,
  /\bquiz\s+me\b/i,
  /\bword(s)?\s+from\s+last\b/i,
  // Japanese
  /ドリル/,
  /単語/,
  /語彙/,
  /ボキャブラリー/,
  /復習/,
  // Korean
  /드릴/,
  /단어/,
  /어휘/,
  /복습/,
];

const LESSON_PATTERNS: RegExp[] = [
  // English
  /\bteach\s+me\b/i,
  /\blesson\b/i,
  /\bexplain\b/i,
  /\bgrammar\b/i,
  /\bconjugat/i,
  /\bparticle\b/i,
  /\b(te|た|です|ます|ば|ない)[\s-]?form\b/i,
  /\blearn\s+about\b/i,
  /\bdifference\s+between\b/i,
  /\bhow\s+do\s+i\s+say\b/i,
  // Japanese
  /レッスン/,
  /教えて/,
  /文法/,
  /説明/,
  /違い/,
  // Korean
  /레슨/,
  /가르쳐/,
  /문법/,
  /설명/,
  /알려줘/,
];

const ROLEPLAY_PATTERNS: RegExp[] = [
  // English
  /\brole[\s-]?play\b/i,
  /\bscenario\b/i,
  /\border(ing)?\b/i,
  /\brestaurant\b/i,
  /\bcaf(e|é)\b/i,
  /\bhotel\b/i,
  /\bjust\s+(chat|talk)\b/i,
  /\bconversat/i,
  /\bpretend\b/i,
  /\blet'?s\s+(talk|chat)\b/i,
  /\bweekend\b/i,
  // Japanese
  /ロールプレイ/,
  /ロープレ/,
  /シナリオ/,
  /話そう/,
  /おしゃべり/,
  /会話/,
  // Korean
  /롤플레이/,
  /역할극/,
  /이야기하/,
  /대화/,
];

/**
 * Classify a single utterance into a likely agenda. Returns null when
 * nothing matches strongly — caller decides whether to keep listening.
 */
export function classifyAgenda(text: string): DetectedAgenda | null {
  if (!text || text.trim().length < 2) return null;
  // Order matters: most specific first.
  if (DRILL_PATTERNS.some((re) => re.test(text))) return "drill";
  if (LESSON_PATTERNS.some((re) => re.test(text))) return "guided";
  if (ROLEPLAY_PATTERNS.some((re) => re.test(text))) return "roleplay";
  return null;
}

/**
 * Backup signal: detect agenda from the tutor's adoption phrases. The tutor
 * speaks in target language reliably (it's the LLM, not STT), so phrases like
 * "first word" or "let me explain" are stable cues even when user STT mangles
 * the original keyword.
 */
const TUTOR_DRILL_PATTERNS: RegExp[] = [
  /first\s+word/i,
  /use\s+(this|the)?\s*word\s+in\s+a\s+sentence/i,
  /最初の単語/,
  /次の単語/,
  /를\s+사용해/,
  /이\s+단어를/,
];

const TUTOR_LESSON_PATTERNS: RegExp[] = [
  /let\s+me\s+explain/i,
  /the\s+rule\s+is/i,
  /で(す|あり)ます[、。]?\s*\S{0,10}\s*という意味/,
  /라는\s+뜻/,
  /~?(는|은)\s+\S+에서/,
];

export function classifyFromTutor(text: string): DetectedAgenda | null {
  if (!text || text.length < 4) return null;
  if (TUTOR_DRILL_PATTERNS.some((re) => re.test(text))) return "drill";
  if (TUTOR_LESSON_PATTERNS.some((re) => re.test(text))) return "guided";
  return null;
}

/**
 * Extract a short scenario label from a role-play request.
 */
export function extractScenarioLabel(text: string): string {
  const orderingMatch = text.match(/\border(?:ing)?\s+(\w[\w\s]{0,30}?)(?:\.|,|$)/i);
  if (orderingMatch?.[1]) return `ordering ${orderingMatch[1].trim()}`;
  if (/\brestaurant\b/i.test(text)) return "at a restaurant";
  if (/\bcaf(e|é)\b/i.test(text)) return "at a café";
  if (/\bhotel\b/i.test(text)) return "checking in";
  if (/\bweekend\b/i.test(text)) return "your weekend";
  return "open chat";
}

/**
 * Extract a short topic label from a lesson request.
 */
export function extractGuidedTopic(text: string): string {
  const teach = text.match(/teach\s+me\s+(?:about\s+)?(\S[^.,!?]{0,40})/i);
  if (teach?.[1]) return teach[1].trim().toLowerCase();
  const explain = text.match(/explain\s+(\S[^.,!?]{0,40})/i);
  if (explain?.[1]) return explain[1].trim().toLowerCase();
  const learn = text.match(/learn\s+about\s+(\S[^.,!?]{0,40})/i);
  if (learn?.[1]) return learn[1].trim().toLowerCase();
  return "custom topic";
}
