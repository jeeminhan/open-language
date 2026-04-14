import { getLearner, upsertErrorPattern, upsertGrammar, markVocabUnknown, upsertExpression, createPhrasingSuggestion, upsertInterest, getActiveLearnerIdFromRequest } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

interface ReviewError {
  observed: string;
  expected: string;
  type: string;
  explanation: string;
  source_message?: string;
  severity: string;
  l1_source?: string | null;
}

interface TutorEval {
  score: number;
  strengths: string[];
  improvements: string[];
  missed_teaching_moments: string[];
}

interface UnknownWord {
  word: string;
  context: string;
  definition: string;
}

interface ErrorCluster {
  name: string;
  description: string;
  error_types: string[];
  root_cause: string;
  recommendation: string;
}

interface PhrasingSuggestionItem {
  original: string;
  suggested: string;
  grammar_point: string;
  explanation: string;
  category: string;
}

interface ExpressionItem {
  expression: string;
  type: string;
  meaning: string;
  context: string;
  learner_used: boolean;
}

interface DetectedInterest {
  category: string;
  name: string;
  details: string | null;
  confidence: number;
  facts?: string[];
}

function callGemini(apiKey: string, model: string, prompt: string, maxTokens = 2000) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
      }),
    }
  );
}

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

export async function POST(req: Request) {
  const { messages } = await req.json();

  if (!Array.isArray(messages) || messages.length < 2) {
    return Response.json({ errors: [], tutorEval: null, unknownWords: [], errorClusters: [] });
  }

  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gemini-2.5-flash";
  if (!apiKey) return Response.json({ errors: [], tutorEval: null, unknownWords: [], errorClusters: [] });

  const userId = await getAuthUserId();
  const learner = await getLearner(getActiveLearnerIdFromRequest(req), userId ?? undefined);
  const lang = learner?.target_language || "Korean";
  const native = learner?.native_language || "English";

  const transcript = messages
    .map((m: { role: string; content: string }) =>
      `${m.role === "user" ? "LEARNER" : "TUTOR"}: ${m.content}`
    )
    .join("\n");

  const isEnglishTarget = lang.toLowerCase() === "english";
  const expressionGuidance = getExpressionGuidance(lang, native);

  // Run all review passes in parallel
  const [errorsResult, evalResult, vocabResult, phrasingsResult, expressionsResult, interestsResult] = await Promise.allSettled([
    // 1. Error review — focus on PATTERNS not individual nitpicks
    callGemini(apiKey, model, `You are a senior ${lang} language teacher reviewing a conversation. Focus on PATTERNS — recurring issues and broad areas for growth, not one-off typos.

Group your findings by pattern. If the learner makes the same type of mistake multiple times, report it ONCE as a pattern with all examples.

Check for:
1. PARTICLES: 은/는, 이/가, 을/를, 에/에서, 으로/로, 의, 와/과
2. SPACING: compound words, verb+noun spacing
3. CONJUGATION: tense, formality, irregular verbs
4. WORD CHOICE: unnatural expressions, direct English translations
5. GRAMMAR: wrong connectors, endings, honorifics
6. FORMALITY: mixing speech levels
7. PATTERNS: the same mistake across multiple messages (most important!)

Conversation:

${transcript}

Return a JSON array. Each item represents a PATTERN (not a single instance):
{
  "observed": "example of the wrong usage",
  "expected": "the correct version",
  "type": "particle|spacing|conjugation|word_choice|grammar|spelling|formality|pattern|context",
  "explanation": "brief English explanation of the PATTERN — why this keeps happening",
  "source_message": "the learner message where this appeared",
  "severity": "low|medium|high",
  "l1_source": "explain English interference if applicable, or null"
}

Prioritize patterns over one-offs. Return [] only if truly perfect. No markdown.`, 2000),

    // 2. Tutor self-evaluation
    callGemini(apiKey, model, `You are evaluating an AI language tutor's performance in this conversation.

Conversation:

${transcript}

Rate the tutor's effectiveness and identify specific improvements.

Return JSON:
{
  "score": 1-10,
  "correction_strategy_effectiveness": "did the tutor's corrections actually help? which approach worked best?",
  "strengths": ["what the tutor did well"],
  "improvements": ["specific things the tutor should do differently"],
  "missed_teaching_moments": ["moments where the tutor could have taught something but didn't"],
  "topic_difficulty_score": 1-10 (how challenging was this conversation for the learner?),
  "topic_difficulty_notes": "was it too easy, too hard, or just right?"
}

No markdown, only JSON.`, 1000),

    // 3. Unknown vocab detection
    callGemini(apiKey, model, `Analyze this ${lang} conversation. Find words/phrases the LEARNER didn't understand.

Look for:
- Learner asking "뭐예요?", "뭐지요?", "무슨 뜻이에요?" etc.
- Learner asking what a word means in English
- Tutor explaining a word the learner clearly didn't know
- Words the tutor used that the learner ignored or misunderstood

Conversation:

${transcript}

Return a JSON array of unknown words:
[{
  "word": "the ${lang} word",
  "context": "the sentence it appeared in",
  "definition": "English definition"
}]

Return [] if the learner understood everything. No markdown.`, 800),

    // 4. Phrasing suggestions — how the learner could have said things better
    callGemini(apiKey, model, `You are a ${lang} language coach. Review the LEARNER's messages and suggest how they could have expressed the same ideas more naturally, using grammar patterns or idioms they might not know yet.

Don't just correct errors — suggest UPGRADES. Show how a more advanced speaker would say the same thing.

Focus on:
${isEnglishTarget ? `- English idioms and phrasal verbs the learner could have used (HIGH PRIORITY)
- Common expressions and collocations that would sound more natural
- Phrasal verbs to replace formal/stilted single-word verbs (e.g. "investigate" → "look into")
${native.toLowerCase() === "korean" ? `- Korean idioms the learner may have translated literally — teach the English equivalent
- 사자성어 or 속담 that have English idiom counterparts` : ""}` : `- Grammar patterns the learner could start using (e.g. -ㄴ/는데, -거든요, -다가)`}
- ${lang} idioms or set phrases that would fit naturally
- More natural word choices or phrasing
- Connectors and sentence-linking patterns

Conversation:

${transcript}

Return a JSON array:
[{
  "original": "what the learner said",
  "suggested": "how it could be said more naturally/advanced",
  "grammar_point": "the grammar pattern or idiom being introduced",
  "explanation": "brief English explanation of why this is better and when to use it",
  "category": "grammar|idiom|phrasing|connector|expression"
}]

Only suggest things that are genuinely useful upgrades, not nitpicks. Max 5 suggestions. No markdown.`, 1200),

    // 5. Expression/idiom detection — track what was encountered
    callGemini(apiKey, model, `Analyze this ${lang} conversation. Identify ${lang} idioms, slang, set phrases, grammar patterns, and expressions used by EITHER the tutor or the learner.

For each, note whether the LEARNER actually produced it or only encountered it from the tutor. This distinction matters — understanding something vs being able to use it are different skills.

${expressionGuidance}

Conversation:

${transcript}

Return a JSON array:
[{
  "expression": "the ${lang} expression/pattern",
  "type": "idiom|slang|phrasal_verb|set_phrase|grammar_pattern|colloquial|honorific|l1_transfer",
  "meaning": "${isEnglishTarget ? "meaning and usage context" : "English meaning"}",
  "context": "the sentence where it appeared",
  "learner_used": true/false (did the LEARNER produce this, or just the tutor?)
}]

Distinguish slang (informal, current, register-limited — e.g. "lowkey", "やばい", "대박") from idioms (fixed figurative phrases — e.g. "break the ice", "猫の手も借りたい"). Include both simple and complex patterns. No markdown.`, 1200),

    // 6. Interest/profile detection — learn about the person
    callGemini(apiKey, model, `Analyze this conversation between a language tutor and learner. Extract any personal interests, preferences, or topics the LEARNER mentions or shows enthusiasm about.

Look for:
- Books, authors, genres they mention or discuss
- Music, artists, bands, songs
- TV shows, movies, anime, dramas, directors
- Hobbies, sports, activities
- Food preferences, restaurants, cooking
- Travel destinations, places they've been or want to go
- Work/career topics they bring up
- Cultural interests (art, history, traditions)
- Games, technology, apps they mention
- People or public figures they reference
- Current events or news topics they discuss

Only extract things the LEARNER clearly cares about — not things the tutor brought up that the learner just went along with. Look for enthusiasm, detail, or repeated mentions.

Conversation:

${transcript}

Return a JSON array:
[{
  "category": "books|music|tv_shows|movies|anime|hobbies|sports|food|travel|work|culture|games|technology|people|news|other",
  "name": "specific name or topic",
  "details": "any specifics mentioned (e.g. 'favorite character is X', 'has been watching since 2020')",
  "facts": ["short atomic facts the learner revealed about this interest, one per string, max ~12 words each, e.g. 'attends a Korean Presbyterian church', 'favorite album is Map of the Soul', 'mains Zelda in Smash'"],
  "confidence": 0.0-1.0 (how confident are you this is a genuine interest vs casual mention?)
}]

Be selective — only include things with confidence >= 0.5. Return [] if no clear interests emerged. No markdown.`, 800),
  ]);

  // Helper to parse a settled result
  async function parseSettled(result: PromiseSettledResult<Response>, fallback: string): Promise<unknown> {
    if (result.status !== "fulfilled" || !result.value.ok) return null;
    const data = await result.value.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || fallback;
    return parseJsonResponse(raw);
  }

  // Parse all results
  let errors: ReviewError[] = [];
  let tutorEval: TutorEval | null = null;
  let unknownWords: UnknownWord[] = [];
  let phrasingSuggestions: PhrasingSuggestionItem[] = [];
  let expressions: ExpressionItem[] = [];
  let detectedInterests: DetectedInterest[] = [];

  const errorsParsed = await parseSettled(errorsResult, "[]");
  if (Array.isArray(errorsParsed)) errors = errorsParsed;

  const evalParsed = await parseSettled(evalResult, "{}");
  if (evalParsed && typeof evalParsed === "object") tutorEval = evalParsed as TutorEval;

  const vocabParsed = await parseSettled(vocabResult, "[]");
  if (Array.isArray(vocabParsed)) unknownWords = vocabParsed;

  const phrasingsParsed = await parseSettled(phrasingsResult, "[]");
  if (Array.isArray(phrasingsParsed)) phrasingSuggestions = phrasingsParsed;

  const exprParsed = await parseSettled(expressionsResult, "[]");
  if (Array.isArray(exprParsed)) expressions = exprParsed;

  const interestsParsed = await parseSettled(interestsResult, "[]");
  if (Array.isArray(interestsParsed)) detectedInterests = interestsParsed;

  // Error clustering (run after we have errors)
  let errorClusters: ErrorCluster[] = [];
  if (errors.length >= 2) {
    try {
      const clusterRes = await callGemini(apiKey, model, `Given these ${lang} language errors from a single learner, group them into higher-level patterns.

Errors:
${errors.map(e => `- ${e.type}: "${e.observed}" → "${e.expected}" (${e.explanation})`).join("\n")}

Group related errors into clusters. Identify the ROOT CAUSE for each cluster.

Return JSON array:
[{
  "name": "short cluster name",
  "description": "what this pattern is",
  "error_types": ["which error types fall in this cluster"],
  "root_cause": "the fundamental reason these errors happen",
  "recommendation": "specific practice advice"
}]

Only create clusters if errors are genuinely related. No markdown.`, 800);
      if (clusterRes.ok) {
        const data = await clusterRes.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
        const parsed = parseJsonResponse(raw);
        if (Array.isArray(parsed)) errorClusters = parsed;
      }
    } catch { /* skip clustering */ }
  }

  // Persist to DB
  if (learner) {
    for (const err of errors) {
      if (err.observed && err.expected) {
        await upsertErrorPattern(
          learner.id,
          err.type || "unknown",
          `${err.observed} → ${err.expected}`,
          err.l1_source || null,
          err.severity || "medium",
          err.source_message || err.observed,
          false
        );
        if (err.type) {
          await upsertGrammar(learner.id, err.type, null, false, err.source_message || err.observed);
        }
      }
    }

    // Persist unknown vocab
    for (const w of unknownWords) {
      if (w.word) {
        await markVocabUnknown(learner.id, w.word);
      }
    }

    // Persist phrasing suggestions
    const sid = null; // no session id in review context
    for (const ps of phrasingSuggestions) {
      if (ps.original && ps.suggested) {
        await createPhrasingSuggestion(
          learner.id, sid, ps.original, ps.suggested,
          ps.grammar_point || null, ps.explanation || null,
          ps.category || "grammar"
        );
      }
    }

    // Persist expressions
    for (const expr of expressions) {
      if (expr.expression) {
        await upsertExpression(
          learner.id, expr.expression, expr.type || "grammar_pattern",
          expr.meaning || null, expr.context || null,
          !!expr.learner_used
        );
      }
    }

    // Persist detected interests
    for (const interest of detectedInterests) {
      if (interest.name && interest.category && (interest.confidence ?? 0) >= 0.5) {
        const factsArr: string[] = Array.isArray((interest as { facts?: unknown }).facts)
          ? ((interest as { facts: unknown[] }).facts.filter((f): f is string => typeof f === "string"))
          : [];
        await upsertInterest(
          learner.id,
          interest.category,
          interest.name,
          interest.details || null,
          "detected",
          interest.confidence ?? 0.7,
          factsArr
        );
      }
    }
  }

  return Response.json({ errors, tutorEval, unknownWords, errorClusters, phrasingSuggestions, expressions, detectedInterests });
}

function getExpressionGuidance(targetLang: string, nativeLang: string): string {
  const target = targetLang.toLowerCase();
  const native = nativeLang.toLowerCase();

  const koreanBridge = native === "korean"
    ? `- Korean-to-English L1 transfer (e.g. "눈이 높다" → "my eyes are high" instead of "I have high standards") — mark as type "l1_transfer"`
    : "";

  switch (target) {
    case "english":
      return `IMPORTANT — For English, pay special attention to:
- Idioms (e.g. "break the ice", "hit the nail on the head", "a piece of cake")
- Slang — current, register-limited informal language (e.g. "lowkey", "no cap", "it's giving", "mid", "bet", "sus", "hits different")
- Phrasal verbs (e.g. "look into", "come up with", "figure out")
- Collocations (e.g. "make a decision" not "do a decision")
- L1 idioms the learner translated literally — mark as type "l1_transfer"
${koreanBridge}
These are HIGH VALUE items to track — idiom and slang mastery are key fluency markers.`;

    case "japanese":
      return `IMPORTANT — For Japanese, pay special attention to:
- 慣用句 / idioms (e.g. 猫の手も借りたい, 腹が立つ, 頭に来る)
- 四字熟語 / four-character idioms (e.g. 一石二鳥, 十人十色, 自業自得) — mark as type "idiom"
- 決まり文句 / set phrases (e.g. お疲れ様です, よろしくお願いします, お世話になっております) — mark as type "set_phrase"
- Slang and casual speech (e.g. やばい, めっちゃ, ぶっちゃけ, ガチ, それな) — mark as type "slang"
- Keigo / honorific forms (謙譲語, 尊敬語, 丁寧語) — mark as type "honorific"
- Sentence-final particles carrying nuance (よ, ね, わ, ぞ, ぜ, かな) — mark as type "colloquial"
- L1 expressions translated literally — mark as type "l1_transfer"
These are HIGH VALUE items to track — natural Japanese relies heavily on set phrases and register.`;

    case "korean":
      return `IMPORTANT — For Korean, pay special attention to:
- 사자성어 / four-character idioms (e.g. 일석이조, 십인십색) — mark as type "idiom"
- 속담 / proverbs (e.g. 가는 말이 고와야 오는 말이 곱다) — mark as type "idiom"
- Set phrases (e.g. 수고하셨습니다, 잘 부탁드립니다) — mark as type "set_phrase"
- Slang (e.g. 대박, 헐, 찐, 킹받네, 갓생, 인정) — mark as type "slang"
- 반말 vs 존댓말 register shifts — mark formal ones as type "honorific"
- Colloquial contractions and particles (e.g. 근데, 아님, -잖아) — mark as type "colloquial"
- L1 expressions translated literally — mark as type "l1_transfer"
These are HIGH VALUE items to track — register and idiomatic fluency mark advanced Korean.`;

    case "spanish":
      return `IMPORTANT — For Spanish, pay special attention to:
- Modismos / idioms (e.g. "tomar el pelo", "estar en las nubes") — mark as type "idiom"
- Refranes / proverbs (e.g. "más vale tarde que nunca") — mark as type "idiom"
- Slang — regional when relevant (tío/güey/che/pana, "guay", "chido", "mola") — mark as type "slang"
- Set phrases (e.g. "por si acaso", "a lo mejor") — mark as type "set_phrase"
- Subjunctive-triggering expressions — mark as type "grammar_pattern"
- L1 expressions translated literally — mark as type "l1_transfer"`;

    case "chinese":
    case "mandarin":
      return `IMPORTANT — For Chinese, pay special attention to:
- 成语 / four-character idioms (e.g. 画蛇添足, 一举两得) — mark as type "idiom"
- 歇后语 / two-part allegorical sayings — mark as type "idiom"
- 口语 expressions and slang (e.g. 牛逼, 靠谱, 佛系, 躺平) — mark as type "slang"
- Set phrases (e.g. 不好意思, 没关系) — mark as type "set_phrase"
- Measure-word collocations — mark as type "colloquial"
- L1 expressions translated literally — mark as type "l1_transfer"`;

    case "french":
      return `IMPORTANT — For French, pay special attention to:
- Idioms (e.g. "poser un lapin", "avoir le cafard") — mark as type "idiom"
- Slang / argot / verlan (e.g. "ouf", "meuf", "kiffer", "relou") — mark as type "slang"
- Set phrases (e.g. "au fait", "du coup", "c'est pas grave") — mark as type "set_phrase"
- Subjunctive-triggering expressions — mark as type "grammar_pattern"
- L1 expressions translated literally — mark as type "l1_transfer"`;

    default:
      return `Pay attention to idioms, slang, set phrases, and any L1 expressions the learner translated literally (mark L1 translations as type "l1_transfer"). These are high-value fluency markers.`;
  }
}
