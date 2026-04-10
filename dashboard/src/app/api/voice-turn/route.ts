import {
  getLearner,
  createSession,
  createTurn,
  updateSessionCounters,
  upsertErrorPattern,
  upsertGrammar,
  upsertVocabulary,
  getActiveLearnerIdFromRequest,
} from "@/lib/db";

function parseJsonResponse(raw: string): unknown {
  const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return JSON.parse(cleaned.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}"));
    } catch {
      return null;
    }
  }
}

interface AnalyzedError {
  observed: string;
  expected: string;
  type: string;
  explanation: string;
  l1_source?: string | null;
  severity?: string;
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    sessionId,
    turnNumber,
    userMessage,
    tutorResponse,
    mode,
  } = body;

  const learner = getLearner(getActiveLearnerIdFromRequest(request));
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  // Create session if needed
  let activeSessionId = sessionId;
  if (!activeSessionId) {
    const session = createSession(learner.id, mode || "voice-web");
    activeSessionId = session.id;
  }

  // Analyze the user message for errors server-side
  let errors: AnalyzedError[] = [];
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gemini-2.5-flash";
  const lang = learner.target_language || "Korean";
  const native = learner.native_language || "English";

  const isEnglishTarget = lang.toLowerCase() === "english";

  if (apiKey && userMessage && userMessage.trim().length >= 2) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `You are a strict ${lang} language error analyzer for a ${native} speaker.

Analyze this learner sentence: "${userMessage}"

Context — the tutor said: "${tutorResponse || ""}"

Check for: grammatical markers, ${isEnglishTarget ? "idiom misuse, phrasal verb errors, collocation errors," : "spacing, conjugation,"} word choice, grammar patterns, spelling, formality, word order.
${isEnglishTarget ? `\nPay special attention to:\n- Literally translated L1 idioms (e.g. Korean 식은 죽 먹기 → "eating cold porridge" instead of "a piece of cake")\n- Wrong prepositions in phrasal verbs\n- Unnatural collocations (e.g. "do a mistake" instead of "make a mistake")` : ""}

Flag everything wrong or unnatural. Be thorough.

Return ONLY a JSON array:
[{"observed":"wrong part","expected":"correct version","type":"particle|spacing|conjugation|word_choice|grammar|spelling|formality|word_order|idiom|collocation","explanation":"brief ${native} explanation","severity":"low|medium|high","l1_source":"${native} interference reason or null"}]

Return [] if perfect. No markdown.` }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
        const parsed = parseJsonResponse(raw);
        if (Array.isArray(parsed)) errors = parsed;
      }
    } catch { /* analysis failed, continue with empty errors */ }
  }

  // Build analysis object
  const analysis: Record<string, unknown> = { errors };

  // Save turn
  const hasErrors = errors.length > 0;
  createTurn(
    activeSessionId,
    turnNumber || 1,
    userMessage || "",
    tutorResponse || "",
    JSON.stringify(analysis),
    false,
    hasErrors ? "none" : null,
    null
  );

  // Update session counters
  updateSessionCounters(activeSessionId, hasErrors ? errors.length : 0, 0, 0);

  // Upsert error patterns
  for (const err of errors) {
    if (err.observed && err.expected) {
      upsertErrorPattern(
        learner.id,
        err.type || "unknown",
        `${err.observed} → ${err.expected}`,
        err.l1_source || null,
        err.severity || "medium",
        userMessage || err.observed,
        false
      );
      if (err.type) {
        upsertGrammar(
          learner.id,
          err.type,
          null,
          false,
          userMessage || err.observed
        );
      }
    }
  }

  // Extract vocabulary from user message
  if (userMessage) {
    const words = userMessage
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((w: string) => w.length >= 2);
    for (const word of words) {
      upsertVocabulary(learner.id, word.toLowerCase(), "target");
    }
  }

  return Response.json({ sessionId: activeSessionId, turnNumber: turnNumber || 1, errors });
}
