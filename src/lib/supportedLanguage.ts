export const SUPPORTED_NATIVE_LANGUAGE = "English";
export const SUPPORTED_TARGET_LANGUAGE = "Japanese";
export const SUPPORTED_PAIR_LABEL = `${SUPPORTED_NATIVE_LANGUAGE}->${SUPPORTED_TARGET_LANGUAGE}`;

export function isSupportedLanguagePair(
  nativeLanguage: string | null | undefined,
  targetLanguage: string | null | undefined
): boolean {
  return (
    nativeLanguage === SUPPORTED_NATIVE_LANGUAGE &&
    targetLanguage === SUPPORTED_TARGET_LANGUAGE
  );
}

export function unsupportedLanguagePairMessage(): string {
  return `Only ${SUPPORTED_NATIVE_LANGUAGE}->${SUPPORTED_TARGET_LANGUAGE} is supported right now.`;
}
