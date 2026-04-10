export async function POST(request: Request) {
  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;

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
                  text: "Transcribe this audio exactly as spoken. Return only the transcription text, nothing else. Preserve the original language — do not translate.",
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
