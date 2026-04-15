import { getAuthUserId } from "@/lib/auth";
import {
  getLearner,
  getActiveLearnerIdFromRequest,
  createSession,
  endSession,
  createTurn,
  upsertErrorPattern,
  upsertGrammar,
  upsertVocabulary,
  updateSessionCounters,
} from "@/lib/db";

export const maxDuration = 90;

const CATEGORY_WORDS = new Set([
  "word_choice", "grammar", "particle", "conjugation", "vocabulary", "syntax", "unknown",
]);

interface SentenceAnalysis {
  text: string;
  errors?: Array<{
    type?: string;
    observed?: string;
    expected?: string;
    severity?: string;
    l1_source?: string;
    pattern_description?: string;
  }>;
  grammar_used_correctly?: Array<{ pattern?: string; level?: string; example?: string }>;
  vocabulary_used?: string[];
}

interface AnalysisPayload {
  summary: string;
  sentences: SentenceAnalysis[];
}

function extractJson(raw: string): AnalysisPayload | null {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed && typeof parsed.summary === "string") {
      return parsed as AnalysisPayload;
    }
  } catch {
    // try to find first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.summary) return parsed as AnalysisPayload;
      } catch { /* */ }
    }
  }
  return null;
}

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId);
  if (!learner) return Response.json({ error: "No learner" }, { status: 400 });

  const { texts } = await request.json();
  if (!Array.isArray(texts) || texts.length === 0) {
    return Response.json({ error: "No texts provided" }, { status: 400 });
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return Response.json({ error: "LLM_API_KEY not configured" }, { status: 500 });

  const model = process.env.LLM_MODEL || "gemini-2.5-flash";
  const targetLang = learner.target_language || "the target language";
  const nativeLang = learner.native_language || "English";
  const level = learner.proficiency_level || "unknown";

  const allText = texts.map((t: string, i: number) => `${i + 1}. "${t}"`).join("\n");

  const prompt = `You are a ${targetLang} tutor. The learner is at ${level} level and speaks ${nativeLang}.

Here are ${texts.length} utterances the learner said during a real conversation:
${allText}

Analyze each utterance and return ONLY valid JSON in this exact shape (no markdown, no code fences):

{
  "summary": "A warm, specific paragraph of feedback in ${nativeLang}. Mention strengths, 2-3 concrete things to improve, and include actual ${targetLang} examples from their speech.",
  "sentences": [
    {
      "text": "the exact utterance as given",
      "errors": [
        {
          "type": "category like word_choice, particle, conjugation",
          "observed": "what they said",
          "expected": "what they should have said",
          "severity": "low|medium|high",
          "l1_source": "why this error likely happened (short)",
          "pattern_description": "the specific grammar construct, e.g. ~(으)면, ~는데, 은/는 vs 이/가. MUST NOT be a category word. Omit if no specific construct applies."
        }
      ],
      "grammar_used_correctly": [
        { "pattern": "specific construct, e.g. ~고 싶다", "level": "beginner|intermediate|advanced", "example": "the utterance or relevant fragment" }
      ],
      "vocabulary_used": ["word1", "word2"]
    }
  ]
}

Include one entry per utterance in "sentences" in the same order. Empty arrays are fine if nothing applies.`;

  let raw = "";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.error("Listen analyze error:", res.status, errText);
      return Response.json({ analysis: "Failed to analyze speech." }, { status: 502 });
    }
    const data = await res.json();
    raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (err) {
    console.error("Listen analyze fetch error:", err);
    return Response.json({ analysis: "Failed to analyze speech." }, { status: 502 });
  }

  const parsed = extractJson(raw);
  if (!parsed) {
    // fall back — still return the raw text so the UI shows something
    return Response.json({ analysis: raw || "No analysis available." });
  }

  // Persist session + turns + errors + grammar + vocab
  let sessionId: string | null = null;
  let totalErrors = 0;
  try {
    const session = await createSession(learner.id, "listen");
    sessionId = session.id;

    for (let i = 0; i < parsed.sentences.length; i++) {
      const s = parsed.sentences[i];
      const userMessage = s.text || texts[i] || "";

      const stripWs = (str: string | undefined) => (str ?? "").replace(/\s+/g, "");
      const errors = (s.errors || []).filter((err) => {
        if ((err.type || "").toLowerCase() === "spacing") return false;
        return stripWs(err.observed) !== stripWs(err.expected);
      });
      for (const err of errors) {
        await upsertErrorPattern(
          learner.id,
          err.type || "unknown",
          err.pattern_description || err.type || "unknown",
          err.l1_source || null,
          err.severity || "medium",
          err.observed || userMessage,
          false
        );
        const pd = err.pattern_description?.trim();
        if (pd && !CATEGORY_WORDS.has(pd.toLowerCase()) && pd.toLowerCase() !== (err.type || "").toLowerCase()) {
          await upsertGrammar(learner.id, pd, null, false, err.observed || userMessage);
        }
        totalErrors++;
      }

      const grammarCorrect = s.grammar_used_correctly || [];
      for (const g of grammarCorrect) {
        if (g.pattern) {
          await upsertGrammar(learner.id, g.pattern, g.level || null, true, g.example || userMessage);
        }
      }

      const vocab = s.vocabulary_used || [];
      for (const word of vocab) {
        if (typeof word === "string" && word.trim()) {
          await upsertVocabulary(learner.id, word.trim().toLowerCase(), "seen");
        }
      }

      await createTurn(
        sessionId,
        i + 1,
        userMessage,
        "", // no tutor response in listen mode
        JSON.stringify({ errors, grammar_used_correctly: grammarCorrect, vocabulary_used: vocab }),
        false,
        null,
        null
      );
    }

    await updateSessionCounters(sessionId, totalErrors, 0, 0);
    await endSession(sessionId, parsed.summary);
  } catch (err) {
    console.error("Failed to persist listen session:", err);
  }

  return Response.json({
    analysis: parsed.summary,
    sessionId,
    errorsFound: totalErrors,
    sentencesAnalyzed: parsed.sentences.length,
  });
}
