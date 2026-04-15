export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || text.trim().length < 3) {
      return Response.json({ cleaned: text });
    }

    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) {
      return Response.json({ cleaned: text });
    }

    const model = process.env.LLM_MODEL || "gemini-2.5-flash";

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: "Clean up this speech-to-text transcript. Fix word boundaries, spacing, punctuation, and grammar while keeping exact meaning and tone. Preserve the original language. Return ONLY the cleaned text.",
              },
            ],
          },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.1 },
        }),
      }
    );

    if (!res.ok) {
      return Response.json({ cleaned: text });
    }

    const data = await res.json();
    const cleaned =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || text;
    return Response.json({ cleaned: cleaned.trim() });
  } catch {
    return Response.json({ cleaned: "" });
  }
}
