const LOCALE_MAP: Record<string, string> = {
  korean: "ko",
  japanese: "ja",
  chinese: "zh",
  "chinese (simplified)": "zh-Hans",
  "chinese (traditional)": "zh-Hant",
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  italian: "it",
  portuguese: "pt",
  russian: "ru",
  arabic: "ar",
  hindi: "hi",
  thai: "th",
  vietnamese: "vi",
};

function resolveLocale(language: string): string {
  const key = language.trim().toLowerCase();
  return LOCALE_MAP[key] ?? "en";
}

const TargetScript: Record<string, RegExp> = {
  ko: /[\uac00-\ud7af]/,
  ja: /[\u3040-\u30ff\u4e00-\u9fff]/,
  zh: /[\u4e00-\u9fff]/,
  "zh-Hans": /[\u4e00-\u9fff]/,
  "zh-Hant": /[\u4e00-\u9fff]/,
};

export function tokenizeForVocab(text: string, language: string): string[] {
  if (!text || !text.trim()) return [];

  const locale = resolveLocale(language);

  const SegmenterCtor =
    (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;

  if (!SegmenterCtor) {
    return text
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter((w) => w.length >= 2);
  }

  const segmenter = new SegmenterCtor(locale, { granularity: "word" });
  const targetScript = TargetScript[locale];
  const words = new Set<string>();

  for (const segment of segmenter.segment(text)) {
    if (!segment.isWordLike) continue;
    const word = segment.segment.trim();
    if (!word) continue;
    if (word.length < 2 && !targetScript) continue;
    if (targetScript && !targetScript.test(word) && word.length < 2) continue;
    words.add(word);
  }

  return Array.from(words).slice(0, 50);
}
