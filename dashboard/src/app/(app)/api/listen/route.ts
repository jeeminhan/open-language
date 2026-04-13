import { getAuthUserId } from "@/lib/auth";

export const maxDuration = 90;

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { audio, language } = await request.json();
  if (!audio) return Response.json({ error: "No audio provided" }, { status: 400 });

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return Response.json({ error: "LLM_API_KEY not configured" }, { status: 500 });

  const model = process.env.LLM_MODEL || "gemini-2.5-flash";

  const langHint = language
    ? `The speakers are expected to be speaking ${language}, but transcribe whatever language they actually speak.`
    : "Detect the spoken language and transcribe in that language.";

  const prompt = `You are a professional transcriber. Listen to this audio and produce a verbatim transcript.

CRITICAL RULES:
1. Transcribe EXACTLY what is said, word-for-word, in the SAME language as the audio.
2. Do NOT translate. If the audio is English, output English. If Spanish, output Spanish. If Korean, output Korean.
3. Do NOT guess or invent content. Only transcribe what you actually hear.
4. If the audio is silent or unintelligible, return an empty list.

${langHint}

If there are multiple distinct voices, label them "Speaker 1", "Speaker 2", etc. Keep the same label for the same voice throughout. If you cannot reliably distinguish voices, use "Speaker 1" for everything.

Return ONLY valid JSON in this exact shape (no markdown, no code fences):
{"utterances": [{"speaker": "Speaker 1", "text": "..."}]}

If no speech detected: {"utterances": []}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: "audio/pcm;rate=16000", data: audio } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
        }),
      }
    );
  } catch (err) {
    clearTimeout(timeout);
    console.error("Gemini listen fetch error:", err);
    return Response.json({ utterances: [], error: "Transcription timed out. Try a shorter clip." }, { status: 504 });
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const err = await res.text();
    console.error("Gemini listen error:", res.status, err);
    return Response.json({ utterances: [], error: `Transcription failed (${res.status})` }, { status: 502 });
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return Response.json(parsed);
  } catch {
    console.error("Failed to parse listen response:", text);
    return Response.json({ utterances: [] });
  }
}
