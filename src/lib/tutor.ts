import OpenAI from "openai";
import * as db from "./db";
import fs from "fs";
import path from "path";
import { sanitizeForPrompt } from "./promptSafety";

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
  apiKey: process.env.LLM_API_KEY || "",
});

const MODEL = process.env.LLM_MODEL || "gemini-2.5-flash";

const SYSTEM_TEMPLATE = fs.readFileSync(
  path.resolve(process.cwd(), process.env.PROMPT_PATH || "prompts/system.txt"),
  "utf-8"
);

async function buildSystemPrompt(learner: db.Learner, sessionId: string): Promise<string> {
  const [activeErrors, recentCorrections, weakGrammar, avoidance, effective, l1Patterns, practiceItems, interests, dueVocab, dueGrammar] = await Promise.all([
    db.getActiveErrors(learner.id),
    db.getRecentCorrections(sessionId),
    db.getWeakGrammar(learner.id),
    db.getAvoidancePatterns(learner.id),
    db.computeEffectiveLevel(learner.id),
    db.getL1Patterns(learner.id),
    db.getSpacedRepetitionItems(learner.id, 5),
    db.getInterests(learner.id),
    db.getDueVocab(learner.id, 8),
    db.getDueGrammar(learner.id, 5),
  ]);

  const errorsText = activeErrors.length > 0
    ? activeErrors.map(e => `- ${e.description} (${e.category}, ${e.occurrence_count}x, ${e.status})`).join("\n")
    : "None yet.";

  const correctionsText = recentCorrections.length > 0
    ? recentCorrections.map(c => `- Turn ${c.turn_number}: ${c.correction_type} — ${c.correction_reasoning || "N/A"}`).join("\n")
    : "None this session.";

  const grammarText = weakGrammar.length > 0
    ? weakGrammar.map(g => `- ${g.pattern} (mastery: ${Math.round(g.mastery_score)}%)`).join("\n")
    : "No weak areas identified yet.";

  const avoidanceText = (avoidance as Array<{description: string}>).length > 0
    ? (avoidance as Array<{description: string}>).map(a => `- ${a.description}`).join("\n")
    : "None identified yet.";

  const effectiveLevel = effective.confidence > 0.3 ? effective.level : (learner.proficiency_level || "A2");
  const levelNote = effective.confidence > 0.3
    ? `${effective.level} (computed: ${Math.round(effective.grammarMastery)}% grammar mastery, ${Math.round(effective.errorRate)}% error rate)`
    : `${learner.proficiency_level || "A2"} (registered — not enough data to adapt yet)`;

  const l1Text = l1Patterns.length > 0
    ? l1Patterns.slice(0, 5).map(p => `- ${p.description}: ${p.l1_source}`).join("\n")
    : "None identified yet.";

  const practiceText = practiceItems.length > 0
    ? practiceItems.map(p => `- ${p.description} (${p.category}, priority ${p.priority})`).join("\n")
    : "No specific focus areas yet.";

  const vocabDueText = dueVocab.length > 0
    ? dueVocab.map(v => `- ${v.word} (${v.srs_state}, reviewed ${v.review_count}x)`).join("\n")
    : "No words in active review yet — introduce new vocab organically and probe when you suspect a gap.";

  const grammarDueText = dueGrammar.length > 0
    ? dueGrammar.map(g => `- ${g.pattern} (${g.srs_state}, reviewed ${g.review_count}x)`).join("\n")
    : "No grammar patterns in active review yet — introduce one naturally when the topic allows.";

  const interestsText = interests.length > 0
    ? interests.slice(0, 8).map(i => {
        const name = sanitizeForPrompt(i.name, 120);
        const category = sanitizeForPrompt(i.category, 60);
        const details = i.details ? `: ${sanitizeForPrompt(i.details, 400)}` : "";
        return `- <interest>${name} (${category}${details})</interest>`;
      }).join("\n")
    : "No interests detected yet — ask about their hobbies and preferences!";

  return SYSTEM_TEMPLATE
    .replace(/{learner_name}/g, learner.name)
    .replace(/{native_language}/g, learner.native_language)
    .replace(/{target_language}/g, learner.target_language)
    .replace(/{proficiency_level}/g, effectiveLevel)
    .replace(/{correction_tolerance}/g, learner.correction_tolerance || "moderate")
    .replace(/{active_errors}/g, errorsText)
    .replace(/{recent_corrections}/g, correctionsText)
    .replace(/{weak_grammar}/g, grammarText)
    .replace(/{avoidance_patterns}/g, avoidanceText)
    .replace(/{level_note}/g, levelNote)
    .replace(/{l1_interference}/g, l1Text)
    .replace(/{practice_focus}/g, practiceText)
    .replace(/{learner_interests}/g, interestsText)
    .replace(/{vocab_due}/g, vocabDueText)
    .replace(/{grammar_due}/g, grammarDueText);
}

interface ParsedResponse {
  response: string;
  analysis: Record<string, unknown> | null;
  raw: string;
}

function parseResponse(raw: string): ParsedResponse {
  const responseMatch = raw.match(/\[RESPONSE\]\s*([\s\S]*?)\s*\[\/RESPONSE\]/);
  const responseText = responseMatch ? responseMatch[1].trim() : raw.trim();

  let analysis: Record<string, unknown> | null = null;
  const analysisMatch = raw.match(/\[ANALYSIS\]\s*([\s\S]*?)\s*\[\/ANALYSIS\]/);
  if (analysisMatch) {
    try {
      analysis = JSON.parse(analysisMatch[1].trim());
    } catch {
      const cleaned = analysisMatch[1].trim().replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      try { analysis = JSON.parse(cleaned); } catch { /* skip */ }
    }
  }

  return { response: responseText, analysis, raw };
}

export interface ChatResult {
  response: string;
  analysis: Record<string, unknown> | null;
  turnNumber: number;
}

export async function chat(
  userMessage: string,
  learner: db.Learner,
  sessionId: string,
  history: Array<{ role: string; content: string }>,
  turnNumber: number
): Promise<ChatResult> {
  const systemPrompt = await buildSystemPrompt(learner, sessionId);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.slice(-20).map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  let raw: string;
  try {
    const completion = await client.chat.completions.create(
      {
        model: MODEL,
        messages,
        temperature: 0.7,
      },
      { signal: AbortSignal.timeout(45000) }
    );
    raw = completion.choices[0].message.content || "";
  } catch (e) {
    raw = `[RESPONSE]\nSorry, I'm having trouble connecting. Error: ${e}\n[/RESPONSE]`;
  }

  const { response, analysis } = parseResponse(raw);

  const correctionAction = (analysis?.correction_action as string) || "none";
  const corrected = ["recast", "correct_explicitly"].includes(correctionAction);
  let errorsCount = 0;
  const correctionsCount = corrected ? 1 : 0;

  if (analysis) {
    const stripWs = (s: string | undefined) => (s ?? "").replace(/\s+/g, "");
    const errors = ((analysis.errors as Array<Record<string, string>>) || []).filter((err) => {
      if ((err.type || "").toLowerCase() === "spacing") return false;
      return stripWs(err.observed) !== stripWs(err.expected);
    });
    for (const err of errors) {
      await db.upsertErrorPattern(
        learner.id,
        err.type || "unknown",
        err.pattern_description || err.type || "unknown",
        err.l1_source || null,
        err.severity || "medium",
        err.observed || userMessage,
        corrected
      );
      // Only track in grammar inventory if we have a real pattern name from the AI.
      // Category names like "word_choice" / "grammar" pollute the page — skip them.
      const categoryWords = new Set(["word_choice", "grammar", "particle", "conjugation", "vocabulary", "syntax", "unknown"]);
      const pd = err.pattern_description?.trim();
      if (pd && !categoryWords.has(pd.toLowerCase()) && pd.toLowerCase() !== (err.type || "").toLowerCase()) {
        await db.upsertGrammar(learner.id, pd, null, false, err.observed || userMessage);
      }
      errorsCount++;
    }

    const grammarCorrect = (analysis.grammar_used_correctly as Array<Record<string, string>>) || [];
    for (const g of grammarCorrect) {
      await db.upsertGrammar(learner.id, g.pattern || "unknown", g.level || null, true, g.example || userMessage);
    }

    const grammarChecks = (analysis.grammar_checks as Array<{ pattern?: string; status?: string; example?: string }>) || [];
    for (const check of grammarChecks) {
      const pattern = check.pattern?.trim();
      if (!pattern) continue;
      const status = check.status;
      if (status === "correct" || status === "known") {
        await db.recordGrammarReview(learner.id, pattern, true, check.example || userMessage);
      } else if (status === "incorrect" || status === "unknown") {
        await db.recordGrammarReview(learner.id, pattern, false, check.example || userMessage);
      }
    }

    const vocab = (analysis.vocabulary_used as string[]) || [];
    for (const word of vocab) {
      if (typeof word === "string" && word.trim()) {
        // Record the word as seen, but do NOT assert mastery — SRS state is driven by vocab_checks.
        await db.upsertVocabulary(learner.id, word.trim().toLowerCase(), "seen");
      }
    }

    const vocabChecks = (analysis.vocab_checks as Array<{ word?: string; status?: string }>) || [];
    for (const check of vocabChecks) {
      const word = check.word?.trim().toLowerCase();
      if (!word) continue;
      const status = check.status;
      if (status === "correct" || status === "known") {
        await db.recordVocabReview(learner.id, word, true);
      } else if (status === "incorrect" || status === "unknown") {
        await db.recordVocabReview(learner.id, word, false);
      }
    }
  }

  await db.updateSessionCounters(sessionId, errorsCount, correctionsCount, 0);

  await db.createTurn(
    sessionId,
    turnNumber,
    userMessage,
    response,
    analysis ? JSON.stringify(analysis) : null,
    corrected,
    correctionAction,
    (analysis?.correction_reasoning as string) || null
  );

  return { response, analysis, turnNumber };
}

export async function suggestTopics(learner: db.Learner): Promise<string[]> {
  const [weakGrammar, activeErrors] = await Promise.all([
    db.getWeakGrammar(learner.id),
    db.getActiveErrors(learner.id, 5),
  ]);

  if (weakGrammar.length === 0 && activeErrors.length === 0) {
    return ["Free conversation — talk about your day!", "Describe your favorite hobby", "Tell me about a recent trip"];
  }

  const prompt = `Based on these weak grammar areas and common errors for a ${learner.native_language} speaker learning ${learner.target_language} at ${learner.proficiency_level} level, suggest 5 conversation topics that would naturally practice these areas.

Weak grammar: ${weakGrammar.map(g => g.pattern).join(", ")}
Common errors: ${activeErrors.map(e => e.description).join(", ")}

Return ONLY a JSON array of 5 topic strings. No markdown, no explanation.`;

  try {
    const completion = await client.chat.completions.create(
      {
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      },
      { signal: AbortSignal.timeout(30000) }
    );
    const raw = (completion.choices[0].message.content || "").trim();
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return ["Free conversation", "Talk about your week", "Describe something you learned recently"];
  }
}
