import { getAuthUserId } from "@/lib/auth";

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { audio } = await request.json();
  if (!audio) return Response.json({ error: "No audio provided" }, { status: 400 });

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return Response.json({ error: "LLM_API_KEY not configured" }, { status: 500 });

  const model = process.env.LLM_MODEL || "gemini-2.5-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/pcm;rate=16000",
                  data: audio,
                },
              },
              {
                text: `Transcribe this audio EXACTLY as spoken in its ORIGINAL language. Do NOT translate. If they speak Korean, write Korean. If they speak Japanese, write Japanese. NEVER convert to English.

There may be multiple speakers — identify and label them consistently (e.g. "Speaker 1", "Speaker 2"). Different voices should get different labels. Keep the same label for the same voice across the conversation.

Return ONLY valid JSON in this exact format, no markdown, no code fences:
{"utterances": [{"speaker": "Speaker 1", "text": "원래 언어로 그대로"}, {"speaker": "Speaker 2", "text": "번역하지 마세요"}]}

If no speech is detected, return: {"utterances": []}
CRITICAL: Output the EXACT words spoken. Do NOT translate to English.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Gemini listen error:", err);
    return Response.json({ utterances: [] });
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return Response.json(parsed);
  } catch {
    console.error("Failed to parse listen response:", text);
    return Response.json({ utterances: [] });
  }
}
