export async function POST(req: Request) {
  const { message, targetLanguage, nativeLanguage, level } = await req.json();

  if (!message || message.trim().length < 2) {
    return Response.json({ errors: [] });
  }

  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    return Response.json({ errors: [] });
  }

  const lang = targetLanguage || "Korean";
  const native = nativeLanguage || "English";
  const lvl = level || "A2";

  const prompt = `You are a strict ${lang} language error analyzer for a ${native} speaker at ${lvl} level.

Be STRICT and THOROUGH. Flag everything that is wrong OR unnatural, even if technically understandable. You are a teacher, not a conversation partner.

Analyze this sentence carefully: "${message}"

Check ALL of the following:
1. PARTICLES/MARKERS: any grammatical markers that are wrong, missing, or unnecessary
2. SPACING/WRITING: proper word boundaries and writing conventions for ${lang}
3. CONJUGATION/INFLECTION: tense, formality level, irregular forms
4. WORD CHOICE: unnatural word choices, direct translations from ${native}
5. GRAMMAR PATTERNS: wrong connectors, wrong endings, agreement issues
6. SPELLING: writing errors, character confusion
7. FORMALITY: mixing register levels, inappropriate politeness
8. WORD ORDER: sentence structure violations

IMPORTANT: Even if the sentence is "understandable", still flag unnatural usage. Learners need to know the NATURAL way to say things in ${lang}.

Return ONLY a JSON array. Each item:
{
  "observed": "the specific wrong part",
  "expected": "the correct version",
  "type": "particle|spacing|conjugation|word_choice|grammar|spelling|formality|word_order",
  "explanation": "brief explanation in ${native} (1 sentence)"
}

If truly no errors, return []. No markdown.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
        }),
      }
    );

    if (!res.ok) return Response.json({ errors: [] });

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

    try {
      const errors = JSON.parse(cleaned);
      if (Array.isArray(errors)) return Response.json({ errors });
    } catch {
      try {
        const fixed = cleaned.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
        const errors = JSON.parse(fixed);
        if (Array.isArray(errors)) return Response.json({ errors });
      } catch { /* give up */ }
    }

    return Response.json({ errors: [] });
  } catch {
    return Response.json({ errors: [] });
  }
}
