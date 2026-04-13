export const LANGUAGE_CODES: Record<string, string> = {
  korean: "ko-KR",
  japanese: "ja-JP",
  chinese: "zh-CN",
  mandarin: "zh-CN",
  cantonese: "zh-HK",
  spanish: "es-ES",
  french: "fr-FR",
  german: "de-DE",
  italian: "it-IT",
  portuguese: "pt-BR",
  russian: "ru-RU",
  arabic: "ar-SA",
  hindi: "hi-IN",
  thai: "th-TH",
  vietnamese: "vi-VN",
  indonesian: "id-ID",
  turkish: "tr-TR",
  dutch: "nl-NL",
  polish: "pl-PL",
  swedish: "sv-SE",
  english: "en-US",
};

export function getLanguageCode(languageName?: string): string | undefined {
  if (!languageName) return undefined;
  return LANGUAGE_CODES[languageName.toLowerCase()];
}
