import { getAuthUserId } from "@/lib/auth";
import { getLearner, getActiveLearnerIdFromRequest } from "@/lib/db";

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const learner = await getLearner(
    getActiveLearnerIdFromRequest(request),
    userId
  );

  const { texts } = await request.json();
  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return Response.json({ error: "No texts provided" }, { status: 400 });
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return Response.json({ error: "LLM_API_KEY not configured" }, { status: 500 });

  const model = process.env.LLM_MODEL || "gemini-2.5-flash";
  const targetLang = learner?.target_language || "the target language";
  const level = learner?.proficiency_level || "unknown";

  const allText = texts.map((t, i) => `${i + 1}. "${t}"`).join("\n");

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
                text: `You are a ${targetLang} language tutor. The learner is at ${level} level.

Here are utterances the learner said during a real conversation:
${allText}

Give a helpful, encouraging analysis:
1. Overall impression — how natural did they sound?
2. Grammar errors — list specific mistakes with corrections
3. Vocabulary — note good word choices and suggest better alternatives where applicable
4. Pronunciation hints — if any words are commonly mispronounced at this level
5. Expressions — suggest natural phrases they could have used

Be specific, reference their actual sentences. Keep it concise and actionable.
Write in English but include the ${targetLang} examples.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
        },
      }),
    }
  );

  if (!res.ok) {
    return Response.json({ analysis: "Failed to analyze speech." });
  }

  const data = await res.json();
  const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis available.";
  return Response.json({ analysis });
}
