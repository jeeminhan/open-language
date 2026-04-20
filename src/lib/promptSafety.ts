const DEFAULT_MAX_LEN = 4000;

const CONTROL_DELIMITERS = [
  /\[\/?\s*RESPONSE\s*\]/gi,
  /\[\/?\s*ANALYSIS\s*\]/gi,
  /\[\/?\s*SYSTEM\s*\]/gi,
  /<\/?unknown>/gi,
  /<\/?user_input>/gi,
  /<\/?transcript>/gi,
  /<\/?web_snippet[^>]*>/gi,
  /<\/?interest>/gi,
];

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function stripDelimiters(raw: string): string {
  let out = raw;
  for (const re of CONTROL_DELIMITERS) {
    out = out.replace(re, "");
  }
  return out;
}

export function sanitizeForPrompt(
  raw: string | null | undefined,
  maxLen: number = DEFAULT_MAX_LEN
): string {
  if (!raw) return "";
  const stripped = stripDelimiters(String(raw))
    .replace(CONTROL_CHARS, " ")
    .replace(/\r\n?/g, "\n");
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen) + "…";
}

export function wrapUserInput(
  raw: string | null | undefined,
  tag: string = "user_input",
  maxLen: number = DEFAULT_MAX_LEN
): string {
  const safe = sanitizeForPrompt(raw, maxLen);
  return `<${tag}>${safe}</${tag}>`;
}

export function wrapUntrustedWebContent(
  raw: string | null | undefined,
  source: string,
  maxLen: number = DEFAULT_MAX_LEN
): string {
  const safe = sanitizeForPrompt(raw, maxLen);
  return `<web_snippet source="${source.replace(/"/g, "'")}">${safe}</web_snippet>`;
}
