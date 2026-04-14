import { supabase } from "./supabase";

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// ── Types ──────────────────────────────────────────────

export interface Learner {
  id: string;
  user_id?: string;
  name: string;
  native_language: string;
  target_language: string;
  proficiency_level: string;
  correction_tolerance: string;
  created_at: string;
}

export interface Session {
  id: string;
  learner_id: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  total_turns: number;
  errors_detected: number;
  corrections_given: number;
  code_switches: number;
  summary?: string | null;
}

export interface Turn {
  id: string;
  session_id: string;
  turn_number: number;
  user_message: string;
  tutor_response: string;
  analysis_json: string | null;
  correction_given: number;
  correction_type: string | null;
  correction_reasoning: string | null;
  created_at: string;
}

export interface ErrorPattern {
  id: string;
  learner_id: string;
  description: string;
  category: string;
  l1_source: string | null;
  severity: string;
  first_seen: string;
  last_seen: string | null;
  occurrence_count: number;
  times_corrected: number;
  times_deferred: number;
  status: string;
  example_utterances: string | null;
}

export interface GrammarItem {
  id: string;
  learner_id: string;
  pattern: string;
  level: string | null;
  correct_uses: number;
  incorrect_uses: number;
  mastery_score: number;
  l1_interference: number;
  first_used: string;
  last_used: string | null;
  example_sentences: string | null;
}

export interface VocabItem {
  id: string;
  word: string;
  reading: string | null;
  language: string;
  times_used: number;
  times_used_correctly: number;
  first_used: string;
  last_used: string | null;
  srs_state: "seen" | "learning" | "reviewing" | "known";
  interval_days: number;
  next_review_at: string | null;
  review_count: number;
  ease_factor: number;
}

export interface Expression {
  id: string;
  learner_id: string;
  expression: string;
  type: string;
  meaning: string | null;
  example_context: string | null;
  proficiency: string;
  times_encountered: number;
  times_produced: number;
  first_seen: string;
  last_seen: string | null;
}

export interface PhrasingSuggestion {
  id: string;
  learner_id: string;
  session_id: string | null;
  original: string;
  suggested: string;
  grammar_point: string | null;
  explanation: string | null;
  category: string;
  created_at: string;
}

export interface LearnerInterest {
  id: string;
  learner_id: string;
  category: string;
  name: string;
  details: string | null;
  source: string;
  confidence: number;
  first_mentioned: string;
  last_mentioned: string | null;
  mention_count: number;
}

export interface TopicCache {
  id: string;
  learner_id: string;
  topic: string;
  context: string | null;
  web_snippet: string | null;
  source_url: string | null;
  interest_id: string | null;
  used: number;
  created_at: string;
}

export interface FluencySnapshot {
  id: string;
  session_id: string;
  avg_utterance_length: number | null;
  self_correction_count: number | null;
  code_switch_count: number | null;
  unique_words_used: number | null;
  grammar_variety_score: number | null;
  created_at: string;
}

// ── Helpers (no DB) ─────────────────────────────────────

export function getActiveLearnerIdFromRequest(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)active_learner=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

// ── Queries ──────────────────────────────────────────────

export async function getLearner(id?: string, userId?: string): Promise<Learner | undefined> {
  if (id) {
    let q = supabase.from("learners").select("*").eq("id", id);
    if (userId) q = q.eq("user_id", userId);
    const { data } = await q.maybeSingle();
    if (data) return data as Learner;
  }
  // Fallback: get first learner for this user (or any if no userId)
  let q = supabase.from("learners").select("*");
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.limit(1).maybeSingle();
  return (data ?? undefined) as Learner | undefined;
}

export async function getAllLearners(userId?: string): Promise<Learner[]> {
  let q = supabase.from("learners").select("*");
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.order("created_at");
  return (data ?? []) as Learner[];
}

export async function getSessions(limitOrLearnerId: number | string = 50, limit?: number): Promise<Session[]> {
  if (typeof limitOrLearnerId === "string") {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("learner_id", limitOrLearnerId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(limit ?? 50);
    return (data ?? []) as Session[];
  }
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(limitOrLearnerId);
  return (data ?? []) as Session[];
}

export async function getSession(id: string): Promise<Session | undefined> {
  const { data } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
  return (data ?? undefined) as Session | undefined;
}

export async function getSessionTurns(sessionId: string): Promise<Turn[]> {
  const { data } = await supabase
    .from("turns")
    .select("*")
    .eq("session_id", sessionId)
    .order("turn_number");
  return (data ?? []) as Turn[];
}

export async function getErrors(learnerId: string): Promise<ErrorPattern[]> {
  const { data } = await supabase
    .from("error_patterns")
    .select("*")
    .eq("learner_id", learnerId)
    .order("occurrence_count", { ascending: false });
  return (data ?? []) as ErrorPattern[];
}

export async function getError(id: string): Promise<ErrorPattern | undefined> {
  const { data } = await supabase.from("error_patterns").select("*").eq("id", id).maybeSingle();
  return (data ?? undefined) as ErrorPattern | undefined;
}

export async function getGrammar(learnerId: string): Promise<GrammarItem[]> {
  const { data } = await supabase
    .from("grammar_inventory")
    .select("*")
    .eq("learner_id", learnerId)
    .order("mastery_score");
  return (data ?? []) as GrammarItem[];
}

export async function getVocabulary(learnerId: string): Promise<VocabItem[]> {
  const { data } = await supabase
    .from("vocabulary")
    .select("*")
    .eq("learner_id", learnerId)
    .order("times_used", { ascending: false });
  return (data ?? []) as VocabItem[];
}

export async function getStats(learnerId: string) {
  const [sessionsRes, turnsRes, secondsRes, wordsRes, errorsRes] = await Promise.all([
    supabase.from("sessions").select("*", { count: "exact", head: true }).eq("learner_id", learnerId),
    supabase.from("turns").select("session_id, sessions!inner(learner_id)", { count: "exact", head: true }).eq("sessions.learner_id", learnerId),
    supabase.from("sessions").select("duration_seconds").eq("learner_id", learnerId).gt("duration_seconds", 0),
    supabase.from("vocabulary").select("*", { count: "exact", head: true }).eq("learner_id", learnerId),
    supabase.from("error_patterns").select("*", { count: "exact", head: true }).eq("learner_id", learnerId),
  ]);

  const totalSeconds = (secondsRes.data ?? []).reduce((s, r) => s + (r.duration_seconds || 0), 0);

  return {
    sessions: sessionsRes.count ?? 0,
    turns: turnsRes.count ?? 0,
    hours: Math.round((totalSeconds / 3600) * 10) / 10,
    uniqueWords: wordsRes.count ?? 0,
    errorPatterns: errorsRes.count ?? 0,
  };
}

export async function getBlindspots(learnerId: string): Promise<GrammarItem[]> {
  const { data } = await supabase
    .from("grammar_inventory")
    .select("*")
    .eq("learner_id", learnerId);
  const items = (data ?? []) as GrammarItem[];
  return items.filter((g) => g.correct_uses + g.incorrect_uses === 0);
}

// ── Write operations ─────────────────────────────────────

export async function createLearner(
  name: string,
  nativeLang: string,
  targetLang: string,
  level: string,
  tolerance: string,
  userId?: string
): Promise<Learner> {
  const id = uid();
  const row: Record<string, unknown> = {
    id, name, native_language: nativeLang, target_language: targetLang,
    proficiency_level: level, correction_tolerance: tolerance,
  };
  if (userId) row.user_id = userId;
  const { data } = await supabase
    .from("learners")
    .insert(row)
    .select()
    .single();
  return data as Learner;
}

export async function createSession(learnerId: string, mode = "text"): Promise<Session> {
  const id = uid();
  const { data } = await supabase
    .from("sessions")
    .insert({ id, learner_id: learnerId, mode, started_at: now() })
    .select()
    .single();
  return data as Session;
}

export async function endSession(sessionId: string, summary?: string | null): Promise<Session> {
  const { data: session } = await supabase.from("sessions").select("started_at").eq("id", sessionId).single();
  const endedAt = now();
  const durationSeconds = session?.started_at
    ? Math.round((new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 1000)
    : 0;

  const update: Record<string, unknown> = { ended_at: endedAt, duration_seconds: durationSeconds };
  if (summary != null) update.summary = summary;

  const { data } = await supabase
    .from("sessions")
    .update(update)
    .eq("id", sessionId)
    .select()
    .single();
  return data as Session;
}

export async function deleteSession(sessionId: string, learnerId: string): Promise<boolean> {
  // Verify ownership before deleting
  const { data: session } = await supabase
    .from("sessions")
    .select("id, learner_id")
    .eq("id", sessionId)
    .single();
  if (!session || session.learner_id !== learnerId) return false;

  await supabase.from("turns").delete().eq("session_id", sessionId);
  await supabase.from("sessions").delete().eq("id", sessionId);
  return true;
}

export async function createTurn(
  sessionId: string,
  turnNumber: number,
  userMessage: string,
  tutorResponse: string,
  analysisJson: string | null,
  correctionGiven: boolean,
  correctionType: string | null,
  correctionReasoning: string | null
): Promise<Turn> {
  const id = uid();
  const { data } = await supabase
    .from("turns")
    .insert({
      id, session_id: sessionId, turn_number: turnNumber, user_message: userMessage,
      tutor_response: tutorResponse, analysis_json: analysisJson,
      correction_given: correctionGiven ? 1 : 0, correction_type: correctionType,
      correction_reasoning: correctionReasoning,
    })
    .select()
    .single();
  return data as Turn;
}

export async function updateSessionCounters(
  sessionId: string,
  errors: number,
  corrections: number,
  codeSwitches: number
): Promise<void> {
  const { data: session } = await supabase
    .from("sessions")
    .select("total_turns, errors_detected, corrections_given, code_switches")
    .eq("id", sessionId)
    .single();
  if (!session) return;

  await supabase
    .from("sessions")
    .update({
      total_turns: (session.total_turns || 0) + 1,
      errors_detected: (session.errors_detected || 0) + errors,
      corrections_given: (session.corrections_given || 0) + corrections,
      code_switches: (session.code_switches || 0) + codeSwitches,
    })
    .eq("id", sessionId);
}

export async function upsertErrorPattern(
  learnerId: string,
  category: string,
  description: string,
  l1Source: string | null,
  severity: string,
  example: string,
  corrected: boolean
): Promise<void> {
  const { data: existing } = await supabase
    .from("error_patterns")
    .select("*")
    .eq("learner_id", learnerId)
    .eq("category", category)
    .eq("description", description)
    .maybeSingle();

  const n = now();
  if (existing) {
    let examples: string[];
    try { examples = JSON.parse(existing.example_utterances || "[]"); } catch { examples = []; }
    if (!examples.includes(example)) examples.push(example);
    const correctionsInc = corrected ? 1 : 0;
    const deferralsInc = corrected ? 0 : 1;
    const status = corrected && existing.times_corrected + correctionsInc >= 3 ? "improving" : existing.status;
    await supabase
      .from("error_patterns")
      .update({
        occurrence_count: existing.occurrence_count + 1,
        last_seen: n,
        times_corrected: existing.times_corrected + correctionsInc,
        times_deferred: existing.times_deferred + deferralsInc,
        status,
        example_utterances: JSON.stringify(examples),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("error_patterns").insert({
      id: uid(), learner_id: learnerId, description, category,
      l1_source: l1Source, severity, last_seen: n,
      times_corrected: corrected ? 1 : 0, times_deferred: corrected ? 0 : 1,
      example_utterances: JSON.stringify([example]),
    });
  }
}

export async function upsertGrammar(
  learnerId: string,
  pattern: string,
  level: string | null,
  correct: boolean,
  example: string
): Promise<void> {
  const n = now();
  const { data: existing } = await supabase
    .from("grammar_inventory")
    .select("*")
    .eq("learner_id", learnerId)
    .eq("pattern", pattern)
    .maybeSingle();

  if (existing) {
    let examples: string[];
    try { examples = JSON.parse(existing.example_sentences || "[]"); } catch { examples = []; }
    if (!examples.includes(example)) { examples.push(example); if (examples.length > 20) examples = examples.slice(-20); }
    const correctUses = existing.correct_uses + (correct ? 1 : 0);
    const incorrectUses = existing.incorrect_uses + (correct ? 0 : 1);
    const total = correctUses + incorrectUses;
    const mastery = total >= 3 ? (correctUses / total) * 100 : 0;
    await supabase
      .from("grammar_inventory")
      .update({ correct_uses: correctUses, incorrect_uses: incorrectUses, mastery_score: mastery, last_used: n, example_sentences: JSON.stringify(examples) })
      .eq("id", existing.id);
  } else {
    await supabase.from("grammar_inventory").insert({
      id: uid(), learner_id: learnerId, pattern, level,
      correct_uses: correct ? 1 : 0, incorrect_uses: correct ? 0 : 1,
      mastery_score: 0, first_used: n, last_used: n, example_sentences: JSON.stringify([example]),
    });
  }
}

// Record that a word was used. Does NOT assert whether the learner knows it —
// SRS state is driven by the tutor via vocab_checks, or by explicit user action.
export async function upsertVocabulary(learnerId: string, word: string, language: string): Promise<void> {
  const n = now();
  const { data: existing } = await supabase
    .from("vocabulary")
    .select("*")
    .eq("learner_id", learnerId)
    .eq("word", word)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("vocabulary")
      .update({ times_used: existing.times_used + 1, last_used: n })
      .eq("id", existing.id);
  } else {
    await supabase.from("vocabulary").insert({
      id: uid(), learner_id: learnerId, word, language, last_used: n,
      srs_state: "seen",
    });
  }
}

export async function markVocabUnknown(learnerId: string, word: string): Promise<void> {
  const n = now();
  const { data: existing } = await supabase
    .from("vocabulary")
    .select("*")
    .eq("learner_id", learnerId)
    .eq("word", word)
    .maybeSingle();

  const due = n;
  if (existing) {
    await supabase.from("vocabulary").update({
      language: "unknown", last_used: n,
      srs_state: "learning", interval_days: 0, next_review_at: due,
    }).eq("id", existing.id);
  } else {
    await supabase.from("vocabulary").insert({
      id: uid(), learner_id: learnerId, word, language: "unknown", last_used: n,
      srs_state: "learning", interval_days: 0, next_review_at: due,
    });
  }
}

export async function markVocabKnown(learnerId: string, word: string): Promise<void> {
  const n = now();
  await supabase
    .from("vocabulary")
    .update({
      language: "target", last_used: n,
      srs_state: "known", next_review_at: null, interval_days: 0,
    })
    .eq("learner_id", learnerId)
    .eq("word", word);
}

// SM-2 lite: correct → extend interval; incorrect → reset to 1 day.
// learning(0d) → reviewing(1d) → reviewing(3d) → reviewing(7d) → reviewing(21d) → known
function nextInterval(current: number, correct: boolean): number {
  if (!correct) return 1;
  if (current < 1) return 1;
  if (current < 3) return 3;
  if (current < 7) return 7;
  if (current < 21) return 21;
  return 60;
}

export async function recordVocabReview(
  learnerId: string,
  word: string,
  correct: boolean
): Promise<void> {
  const n = now();
  const { data: existing } = await supabase
    .from("vocabulary")
    .select("*")
    .eq("learner_id", learnerId)
    .eq("word", word)
    .maybeSingle();

  if (!existing) {
    // First time we hear of it and tutor flagged a check — treat as learning.
    await supabase.from("vocabulary").insert({
      id: uid(), learner_id: learnerId, word, language: correct ? "target" : "unknown",
      last_used: n, srs_state: correct ? "reviewing" : "learning",
      interval_days: correct ? 1 : 0, next_review_at: n, review_count: 1,
    });
    return;
  }

  const interval = nextInterval(existing.interval_days || 0, correct);
  const nextReview = new Date(Date.now() + interval * 86_400_000).toISOString();
  let srsState = existing.srs_state || "seen";
  if (!correct) srsState = "learning";
  else if (interval >= 60) srsState = "known";
  else srsState = "reviewing";

  await supabase
    .from("vocabulary")
    .update({
      srs_state: srsState,
      interval_days: interval,
      next_review_at: srsState === "known" ? null : nextReview,
      review_count: (existing.review_count || 0) + 1,
      times_used: existing.times_used + 1,
      times_used_correctly: existing.times_used_correctly + (correct ? 1 : 0),
      last_used: n,
      language: srsState === "known" ? "target" : (srsState === "learning" ? "unknown" : existing.language),
    })
    .eq("id", existing.id);
}

// Words the tutor should actively weave into the current session.
// Prioritize: 1) learning (never reviewed correctly), 2) reviewing + due now.
export async function getDueVocab(learnerId: string, limit = 8): Promise<VocabItem[]> {
  const nowIso = now();
  const { data } = await supabase
    .from("vocabulary")
    .select("*")
    .eq("learner_id", learnerId)
    .in("srs_state", ["learning", "reviewing"])
    .or(`next_review_at.is.null,next_review_at.lte.${nowIso}`)
    .order("srs_state") // 'learning' < 'reviewing' alphabetically
    .order("next_review_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  return (data ?? []) as VocabItem[];
}

export async function getLearningVocab(learnerId: string): Promise<VocabItem[]> {
  const { data } = await supabase
    .from("vocabulary")
    .select("*")
    .eq("learner_id", learnerId)
    .in("srs_state", ["learning", "reviewing"])
    .order("next_review_at", { ascending: true, nullsFirst: true });
  return (data ?? []) as VocabItem[];
}

// ── Expressions ──

export async function upsertExpression(
  learnerId: string, expression: string, type: string,
  meaning: string | null, context: string | null, produced: boolean
): Promise<void> {
  const n = now();
  const { data: existing } = await supabase
    .from("expressions")
    .select("*")
    .eq("learner_id", learnerId)
    .eq("expression", expression)
    .maybeSingle();

  if (existing) {
    const newProduced = existing.times_produced + (produced ? 1 : 0);
    const newEncountered = existing.times_encountered + 1;
    let proficiency = existing.proficiency;
    if (produced && proficiency === "passive") proficiency = "emerging";
    if (newProduced >= 3 && proficiency === "emerging") proficiency = "active";
    if (newProduced >= 8) proficiency = "mastered";

    await supabase
      .from("expressions")
      .update({
        times_encountered: newEncountered, times_produced: newProduced,
        proficiency, last_seen: n,
        example_context: context ?? existing.example_context,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("expressions").insert({
      id: uid(), learner_id: learnerId, expression, type, meaning,
      example_context: context, proficiency: produced ? "emerging" : "passive",
      times_produced: produced ? 1 : 0, last_seen: n,
    });
  }
}

export async function getExpressions(learnerId: string): Promise<Expression[]> {
  const { data } = await supabase
    .from("expressions")
    .select("*")
    .eq("learner_id", learnerId)
    .order("proficiency")
    .order("times_encountered", { ascending: false });
  return (data ?? []) as Expression[];
}

export async function updateExpressionProficiency(id: string, proficiency: string): Promise<void> {
  await supabase.from("expressions").update({ proficiency }).eq("id", id);
}

// ── Phrasing Suggestions ──

export async function createPhrasingSuggestion(
  learnerId: string, sessionId: string | null, original: string,
  suggested: string, grammarPoint: string | null, explanation: string | null, category: string
): Promise<void> {
  await supabase.from("phrasing_suggestions").insert({
    id: uid(), learner_id: learnerId, session_id: sessionId, original,
    suggested, grammar_point: grammarPoint, explanation, category,
  });
}

export async function getPhrasingSuggestions(learnerId: string, limit = 20): Promise<PhrasingSuggestion[]> {
  const { data } = await supabase
    .from("phrasing_suggestions")
    .select("*")
    .eq("learner_id", learnerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PhrasingSuggestion[];
}

export async function getWeakGrammar(learnerId: string): Promise<GrammarItem[]> {
  const { data } = await supabase
    .from("grammar_inventory")
    .select("*")
    .eq("learner_id", learnerId)
    .lt("mastery_score", 50);
  const items = (data ?? []) as GrammarItem[];
  return items
    .filter((g) => g.correct_uses + g.incorrect_uses >= 3)
    .sort((a, b) => a.mastery_score - b.mastery_score)
    .slice(0, 10);
}

export async function getActiveErrors(learnerId: string, limit = 10): Promise<ErrorPattern[]> {
  const { data } = await supabase
    .from("error_patterns")
    .select("*")
    .eq("learner_id", learnerId)
    .neq("status", "resolved")
    .order("occurrence_count", { ascending: false })
    .limit(limit);
  return (data ?? []) as ErrorPattern[];
}

export async function getRecentCorrections(sessionId: string, limit = 3): Promise<Turn[]> {
  const { data } = await supabase
    .from("turns")
    .select("*")
    .eq("session_id", sessionId)
    .eq("correction_given", 1)
    .order("turn_number", { ascending: false })
    .limit(limit);
  return (data ?? []) as Turn[];
}

export async function getAvoidancePatterns(learnerId: string) {
  const { data } = await supabase
    .from("avoidance_patterns")
    .select("*")
    .eq("learner_id", learnerId);
  return data ?? [];
}

export async function computeEffectiveLevel(learnerId: string): Promise<{
  level: string;
  confidence: number;
  grammarMastery: number;
  errorRate: number;
  totalDataPoints: number;
}> {
  const [grammarRes, sessionsRes] = await Promise.all([
    supabase.from("grammar_inventory").select("mastery_score, correct_uses, incorrect_uses").eq("learner_id", learnerId),
    supabase
      .from("sessions")
      .select("total_turns, errors_detected")
      .eq("learner_id", learnerId)
      .not("ended_at", "is", null)
      .gt("total_turns", 0)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  const grammarItems = (grammarRes.data ?? []).filter(
    (g) => g.correct_uses + g.incorrect_uses >= 3
  );
  const grammarMastery =
    grammarItems.length > 0
      ? grammarItems.reduce((s, g) => s + g.mastery_score, 0) / grammarItems.length
      : 0;

  const recentSessions = sessionsRes.data ?? [];
  let errorRate = 0;
  if (recentSessions.length > 0) {
    const totalTurns = recentSessions.reduce((s, r) => s + r.total_turns, 0);
    const totalErrors = recentSessions.reduce((s, r) => s + r.errors_detected, 0);
    errorRate = totalTurns > 0 ? (totalErrors / totalTurns) * 100 : 0;
  }

  const totalDataPoints = grammarItems.length + recentSessions.length;
  const confidence = Math.min(1, totalDataPoints / 20);

  let level: string;
  if (grammarMastery >= 85 && errorRate < 10) level = "C1";
  else if (grammarMastery >= 70 && errorRate < 20) level = "B2";
  else if (grammarMastery >= 55 && errorRate < 35) level = "B1";
  else if (grammarMastery >= 35 && errorRate < 50) level = "A2";
  else level = "A1";

  return { level, confidence, grammarMastery, errorRate, totalDataPoints };
}

export async function getSpacedRepetitionItems(
  learnerId: string,
  limit = 5
): Promise<Array<ErrorPattern & { priority: number }>> {
  const { data } = await supabase
    .from("error_patterns")
    .select("*")
    .eq("learner_id", learnerId)
    .neq("status", "resolved");

  const errors = (data ?? []) as ErrorPattern[];
  const nowMs = Date.now();

  errors.sort((a, b) => {
    const daysSinceA = a.last_seen ? (nowMs - new Date(a.last_seen).getTime()) / 86_400_000 : 999;
    const daysSinceB = b.last_seen ? (nowMs - new Date(b.last_seen).getTime()) / 86_400_000 : 999;
    if (daysSinceB !== daysSinceA) return daysSinceB - daysSinceA;
    const uncorrectedA = a.occurrence_count - a.times_corrected;
    const uncorrectedB = b.occurrence_count - b.times_corrected;
    if (uncorrectedB !== uncorrectedA) return uncorrectedB - uncorrectedA;
    return b.occurrence_count - a.occurrence_count;
  });

  return errors.slice(0, limit).map((e, i) => ({
    ...e,
    priority: limit - i,
  }));
}

export async function getL1Patterns(learnerId: string): Promise<ErrorPattern[]> {
  const { data } = await supabase
    .from("error_patterns")
    .select("*")
    .eq("learner_id", learnerId)
    .not("l1_source", "is", null)
    .neq("l1_source", "")
    .order("occurrence_count", { ascending: false });
  return (data ?? []) as ErrorPattern[];
}

export async function getVocabGrowth(learnerId: string): Promise<Array<{ date: string; cumulative: number }>> {
  const { data } = await supabase
    .from("vocabulary")
    .select("first_used")
    .eq("learner_id", learnerId)
    .order("first_used");

  const rows = data ?? [];
  const dateCountMap = new Map<string, number>();
  for (const row of rows) {
    const date = row.first_used?.slice(0, 10) ?? "";
    if (date) dateCountMap.set(date, (dateCountMap.get(date) ?? 0) + 1);
  }

  let cumulative = 0;
  const result: Array<{ date: string; cumulative: number }> = [];
  for (const [date, count] of [...dateCountMap.entries()].sort()) {
    cumulative += count;
    result.push({ date, cumulative });
  }
  return result;
}

export async function getSessionMetrics(learnerId: string, limit = 50): Promise<Array<{
  date: string;
  errorRate: number;
  turns: number;
  errors: number;
  corrections: number;
  duration: number;
}>> {
  const { data } = await supabase
    .from("sessions")
    .select("started_at, total_turns, errors_detected, corrections_given, duration_seconds")
    .eq("learner_id", learnerId)
    .not("ended_at", "is", null)
    .gt("total_turns", 0)
    .order("started_at")
    .limit(limit);

  return (data ?? []).map((s) => ({
    date: s.started_at?.slice(0, 10) ?? "",
    errorRate: s.total_turns > 0 ? Math.round((s.errors_detected / s.total_turns) * 100) : 0,
    turns: s.total_turns,
    errors: s.errors_detected,
    corrections: s.corrections_given,
    duration: Math.round((s.duration_seconds ?? 0) / 60),
  }));
}

// ── Session recap ──

export interface SessionRecap {
  sessionId: string;
  vocabLearned: string[];   // words marked unknown/incorrect (new or failed in this session)
  vocabReviewed: string[];  // words marked correct/known (recalled successfully)
  grammarPracticed: string[];
  errorCount: number;
  topErrors: string[];      // top 3 error patterns by frequency in this session
}

export async function getSessionRecap(sessionId: string): Promise<SessionRecap> {
  const turns = await getSessionTurns(sessionId);
  const learned = new Set<string>();
  const reviewed = new Set<string>();
  const grammar = new Set<string>();
  const errorCounts = new Map<string, number>();
  let errorCount = 0;

  for (const turn of turns) {
    if (!turn.analysis_json) continue;
    let analysis: Record<string, unknown>;
    try { analysis = JSON.parse(turn.analysis_json); } catch { continue; }

    const vocabChecks = (analysis.vocab_checks as Array<{ word?: string; status?: string }>) || [];
    for (const c of vocabChecks) {
      const w = c.word?.trim().toLowerCase();
      if (!w) continue;
      if (c.status === "correct" || c.status === "known") reviewed.add(w);
      else if (c.status === "unknown" || c.status === "incorrect") learned.add(w);
    }

    const grammarCorrect = (analysis.grammar_used_correctly as Array<{ pattern?: string }>) || [];
    for (const g of grammarCorrect) {
      if (g.pattern?.trim()) grammar.add(g.pattern.trim());
    }

    const errors = (analysis.errors as Array<{ pattern_description?: string; type?: string }>) || [];
    for (const e of errors) {
      errorCount++;
      const key = e.pattern_description?.trim() || e.type?.trim();
      if (key) errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
    }
  }

  const topErrors = [...errorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  return {
    sessionId,
    vocabLearned: [...learned],
    vocabReviewed: [...reviewed],
    grammarPracticed: [...grammar],
    errorCount,
    topErrors,
  };
}

export async function getVocabSummary(learnerId: string): Promise<{
  learning: number;
  due: number;
  known: number;
  total: number;
}> {
  const { data } = await supabase
    .from("vocabulary")
    .select("srs_state, next_review_at")
    .eq("learner_id", learnerId);
  const rows = data ?? [];
  const nowMs = Date.now();
  let learning = 0, due = 0, known = 0;
  for (const r of rows) {
    if (r.srs_state === "learning" || r.srs_state === "reviewing") {
      learning++;
      if (!r.next_review_at || new Date(r.next_review_at).getTime() <= nowMs) due++;
    } else if (r.srs_state === "known") {
      known++;
    }
  }
  return { learning, due, known, total: rows.length };
}

// ── Learner Interests ──

export async function getInterests(learnerId: string): Promise<LearnerInterest[]> {
  const { data } = await supabase
    .from("learner_interests")
    .select("*")
    .eq("learner_id", learnerId)
    .order("mention_count", { ascending: false })
    .order("last_mentioned", { ascending: false });
  return (data ?? []) as LearnerInterest[];
}

export async function upsertInterest(
  learnerId: string,
  category: string,
  name: string,
  details: string | null,
  source: string,
  confidence: number
): Promise<void> {
  const n = now();
  const normalizedName = name.toLowerCase().trim();
  const { data: existing } = await supabase
    .from("learner_interests")
    .select("*")
    .eq("learner_id", learnerId)
    .ilike("name", normalizedName)
    .maybeSingle();

  if (existing) {
    const newDetails = details && details !== existing.details
      ? [existing.details, details].filter(Boolean).join("; ")
      : existing.details;
    await supabase
      .from("learner_interests")
      .update({
        mention_count: existing.mention_count + 1,
        last_mentioned: n,
        details: newDetails ?? existing.details,
        confidence: Math.max(existing.confidence, confidence),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("learner_interests").insert({
      id: uid(), learner_id: learnerId, category, name, details,
      source, confidence, last_mentioned: n,
    });
  }
}

export async function deleteInterest(id: string): Promise<void> {
  await supabase.from("learner_interests").delete().eq("id", id);
}

export async function getCachedTopics(learnerId: string, limit = 10): Promise<TopicCache[]> {
  const { data } = await supabase
    .from("topic_cache")
    .select("*")
    .eq("learner_id", learnerId)
    .eq("used", 0)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as TopicCache[];
}

export async function cacheTopics(
  learnerId: string,
  topics: Array<{ topic: string; context: string | null; webSnippet: string | null; sourceUrl: string | null; interestId: string | null }>
): Promise<void> {
  const rows = topics.map((t) => ({
    id: uid(), learner_id: learnerId, topic: t.topic,
    context: t.context, web_snippet: t.webSnippet,
    source_url: t.sourceUrl, interest_id: t.interestId,
  }));
  await supabase.from("topic_cache").insert(rows);
}

export async function markTopicUsed(id: string): Promise<void> {
  await supabase.from("topic_cache").update({ used: 1 }).eq("id", id);
}
