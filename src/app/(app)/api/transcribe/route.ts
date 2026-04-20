import { getAuthUserId } from "@/lib/auth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { enforceBodySize, BODY_LIMITS } from "@/lib/bodyLimit";

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await enforceRateLimit(userId, "transcribe", RATE_LIMITS.expensive);
  if (limited) return limited;
  const tooLarge = enforceBodySize(request, BODY_LIMITS.audioMultipart);
  if (tooLarge) return tooLarge;

  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;
  const language = (formData.get("language") as string | null)?.trim() || "";

  if (!audioFile) {
    return Response.json({ error: "No audio file" }, { status: 400 });
  }

  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    return Response.json({ error: "LLM_API_KEY not configured" }, { status: 500 });
  }

  const arrayBuffer = await audioFile.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString("base64");

  // Determine MIME type from the file
  const mimeType = audioFile.type || "audio/webm";

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Audio,
                  },
                },
                {
                  text: buildTranscribePrompt(language),
                },
              ],
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Gemini API error: ${err}` }, { status: 502 });
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    return Response.json({ text, source: "gemini" });
  } catch (e) {
    return Response.json(
      { error: `Transcription failed: ${e}` },
      { status: 500 }
    );
  }
}

function buildTranscribePrompt(language: string): string {
  const lang = language.toLowerCase();
  const base = "Transcribe this audio exactly as spoken. Return ONLY the transcription text, no commentary, no quotes, no translation.";
  if (/japanese/.test(lang)) {
    return `${base} The speaker is using Japanese. Use natural written Japanese orthography: proper kanji where a native writer would use them, hiragana/katakana as appropriate, full-width punctuation (、。！？). DO NOT insert spaces between words, morphemes, or particles — Japanese is written without spaces. Do not transliterate to romaji.`;
  }
  if (/korean/.test(lang)) {
    return `${base} The speaker is using Korean. Use natural Hangul orthography with normal Korean word spacing (띄어쓰기) — spaces only between eojeol boundaries, not between every syllable or morpheme. Do not transliterate to romaja.`;
  }
  if (/chinese|mandarin/.test(lang)) {
    return `${base} The speaker is using Chinese. Use natural Hanzi orthography with full-width punctuation. DO NOT insert spaces between characters or words — Chinese is written without spaces. Do not transliterate to pinyin.`;
  }
  return `${base} Preserve the original language — do not translate. Use natural orthography and word spacing for that language.`;
}
