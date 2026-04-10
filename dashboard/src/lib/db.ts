import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.resolve(
  process.cwd(),
  process.env.DB_PATH || "../voice_tutor.db"
);

/** Returns true when a local SQLite database exists (local dev only). */
export function isDbAvailable(): boolean {
  return fs.existsSync(DB_PATH);
}

const _useMemory = !fs.existsSync(DB_PATH);
let _memDb: Database.Database | null = null;
let _dbRead: Database.Database | null = null;
let _dbWrite: Database.Database | null = null;

/** When the on-disk database doesn't exist, use a shared in-memory DB. */
function getMemoryDb(): Database.Database {
  if (!_memDb) {
    _memDb = new Database(":memory:");
    _memDb.pragma("foreign_keys = ON");
    _memDb.exec(`
      CREATE TABLE IF NOT EXISTS learners (
        id TEXT PRIMARY KEY, name TEXT, native_language TEXT, target_language TEXT,
        proficiency_level TEXT, correction_tolerance TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, learner_id TEXT, mode TEXT, started_at TIMESTAMP,
        ended_at TIMESTAMP, duration_seconds INTEGER, total_turns INTEGER DEFAULT 0,
        errors_detected INTEGER DEFAULT 0, corrections_given INTEGER DEFAULT 0, code_switches INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS turns (
        id TEXT PRIMARY KEY, session_id TEXT, turn_number INTEGER, user_message TEXT,
        tutor_response TEXT, analysis_json TEXT, correction_given INTEGER DEFAULT 0,
        correction_type TEXT, correction_reasoning TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS error_patterns (
        id TEXT PRIMARY KEY, learner_id TEXT, description TEXT, category TEXT,
        l1_source TEXT, severity TEXT, first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP, occurrence_count INTEGER DEFAULT 1, times_corrected INTEGER DEFAULT 0,
        times_deferred INTEGER DEFAULT 0, status TEXT DEFAULT 'active', example_utterances TEXT
      );
      CREATE TABLE IF NOT EXISTS grammar_inventory (
        id TEXT PRIMARY KEY, learner_id TEXT, pattern TEXT, level TEXT,
        correct_uses INTEGER DEFAULT 0, incorrect_uses INTEGER DEFAULT 0, mastery_score REAL DEFAULT 0,
        l1_interference INTEGER DEFAULT 0, first_used TIMESTAMP, last_used TIMESTAMP, example_sentences TEXT
      );
      CREATE TABLE IF NOT EXISTS vocabulary (
        id TEXT PRIMARY KEY, learner_id TEXT, word TEXT, reading TEXT,
        language TEXT, times_used INTEGER DEFAULT 1, times_used_correctly INTEGER DEFAULT 0,
        first_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_used TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS avoidance_patterns (
        id TEXT PRIMARY KEY, learner_id TEXT, pattern TEXT, last_checked TIMESTAMP
      );
    `);
    ensureExtraTables(_memDb);
  }
  return _memDb;
}

function getDb(): Database.Database {
  if (_useMemory) return getMemoryDb();
  if (!_dbRead) {
    _dbRead = new Database(DB_PATH, { readonly: true });
    _dbRead.pragma("journal_mode = WAL");
  }
  return _dbRead;
}

function getWriteDb(): Database.Database {
  if (_useMemory) return getMemoryDb();
  if (!_dbWrite) {
    _dbWrite = new Database(DB_PATH);
    _dbWrite.pragma("journal_mode = WAL");
    _dbWrite.pragma("foreign_keys = ON");
    ensureExtraTables(_dbWrite);
  }
  return _dbWrite;
}

function ensureExtraTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS learner_interests (
      id TEXT PRIMARY KEY,
      learner_id TEXT REFERENCES learners(id),
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      details TEXT,
      source TEXT DEFAULT 'detected',
      confidence REAL DEFAULT 0.7,
      first_mentioned TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_mentioned TIMESTAMP,
      mention_count INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS topic_cache (
      id TEXT PRIMARY KEY,
      learner_id TEXT REFERENCES learners(id),
      topic TEXT NOT NULL,
      context TEXT,
      web_snippet TEXT,
      source_url TEXT,
      interest_id TEXT,
      used INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expressions (
      id TEXT PRIMARY KEY,
      learner_id TEXT REFERENCES learners(id),
      expression TEXT NOT NULL,
      type TEXT NOT NULL,
      meaning TEXT,
      example_context TEXT,
      proficiency TEXT DEFAULT 'passive',
      times_encountered INTEGER DEFAULT 1,
      times_produced INTEGER DEFAULT 0,
      first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS phrasing_suggestions (
      id TEXT PRIMARY KEY,
      learner_id TEXT REFERENCES learners(id),
      session_id TEXT,
      original TEXT NOT NULL,
      suggested TEXT NOT NULL,
      grammar_point TEXT,
      explanation TEXT,
      category TEXT DEFAULT 'grammar',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface Learner {
  id: string;
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

// ── Queries ──────────────────────────────────────────────

export function getLearner(id?: string): Learner | undefined {
  if (id) {
    const byId = getDb().prepare("SELECT * FROM learners WHERE id = ?").get(id) as Learner | undefined;
    if (byId) return byId;
  }
  return getDb().prepare("SELECT * FROM learners LIMIT 1").get() as
    | Learner
    | undefined;
}

export function getActiveLearnerIdFromRequest(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)active_learner=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function getSessions(limitOrLearnerId: number | string = 50, limit?: number): Session[] {
  if (typeof limitOrLearnerId === "string") {
    return getDb()
      .prepare(
        "SELECT * FROM sessions WHERE learner_id = ? AND ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?"
      )
      .all(limitOrLearnerId, limit ?? 50) as Session[];
  }
  return getDb()
    .prepare(
      "SELECT * FROM sessions WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?"
    )
    .all(limitOrLearnerId) as Session[];
}

export function getSession(id: string): Session | undefined {
  return getDb()
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(id) as Session | undefined;
}

export function getSessionTurns(sessionId: string): Turn[] {
  return getDb()
    .prepare(
      "SELECT * FROM turns WHERE session_id = ? ORDER BY turn_number"
    )
    .all(sessionId) as Turn[];
}

export function getErrors(learnerId: string): ErrorPattern[] {
  return getDb()
    .prepare(
      "SELECT * FROM error_patterns WHERE learner_id = ? ORDER BY occurrence_count DESC"
    )
    .all(learnerId) as ErrorPattern[];
}

export function getError(id: string): ErrorPattern | undefined {
  return getDb()
    .prepare("SELECT * FROM error_patterns WHERE id = ?")
    .get(id) as ErrorPattern | undefined;
}

export function getGrammar(learnerId: string): GrammarItem[] {
  return getDb()
    .prepare(
      "SELECT * FROM grammar_inventory WHERE learner_id = ? ORDER BY mastery_score ASC"
    )
    .all(learnerId) as GrammarItem[];
}

export function getVocabulary(learnerId: string): VocabItem[] {
  return getDb()
    .prepare(
      "SELECT * FROM vocabulary WHERE learner_id = ? ORDER BY times_used DESC"
    )
    .all(learnerId) as VocabItem[];
}

export function getStats(learnerId: string) {
  const db = getDb();
  const totalSessions = db
    .prepare("SELECT COUNT(*) as cnt FROM sessions WHERE learner_id = ?")
    .get(learnerId) as { cnt: number };
  const totalTurns = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM turns t JOIN sessions s ON t.session_id = s.id WHERE s.learner_id = ?"
    )
    .get(learnerId) as { cnt: number };
  const totalSeconds = db
    .prepare(
      "SELECT COALESCE(SUM(duration_seconds), 0) as total FROM sessions WHERE learner_id = ? AND duration_seconds > 0"
    )
    .get(learnerId) as { total: number };
  const totalWords = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM vocabulary WHERE learner_id = ?"
    )
    .get(learnerId) as { cnt: number };
  const totalErrors = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM error_patterns WHERE learner_id = ?"
    )
    .get(learnerId) as { cnt: number };

  return {
    sessions: totalSessions.cnt,
    turns: totalTurns.cnt,
    hours: Math.round((totalSeconds.total / 3600) * 10) / 10,
    uniqueWords: totalWords.cnt,
    errorPatterns: totalErrors.cnt,
  };
}

export function getBlindspots(learnerId: string): GrammarItem[] {
  return getDb()
    .prepare(
      "SELECT * FROM grammar_inventory WHERE learner_id = ? AND (correct_uses + incorrect_uses) = 0"
    )
    .all(learnerId) as GrammarItem[];
}

// ── Write operations ─────────────────────────────────────

export function getAllLearners(): Learner[] {
  return getDb().prepare("SELECT * FROM learners ORDER BY created_at").all() as Learner[];
}

export function createLearner(
  name: string,
  nativeLang: string,
  targetLang: string,
  level: string,
  tolerance: string
): Learner {
  const id = uid();
  getWriteDb()
    .prepare(
      "INSERT INTO learners (id, name, native_language, target_language, proficiency_level, correction_tolerance) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(id, name, nativeLang, targetLang, level, tolerance);
  return getDb().prepare("SELECT * FROM learners WHERE id = ?").get(id) as Learner;
}

export function createSession(learnerId: string, mode = "text"): Session {
  const id = uid();
  getWriteDb()
    .prepare("INSERT INTO sessions (id, learner_id, mode, started_at) VALUES (?, ?, ?, ?)")
    .run(id, learnerId, mode, now());
  return getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Session;
}

export function endSession(sessionId: string): Session {
  const n = now();
  getWriteDb()
    .prepare(
      "UPDATE sessions SET ended_at = ?, duration_seconds = CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER) WHERE id = ?"
    )
    .run(n, n, sessionId);
  return getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as Session;
}

export function createTurn(
  sessionId: string,
  turnNumber: number,
  userMessage: string,
  tutorResponse: string,
  analysisJson: string | null,
  correctionGiven: boolean,
  correctionType: string | null,
  correctionReasoning: string | null
): Turn {
  const id = uid();
  getWriteDb()
    .prepare(
      "INSERT INTO turns (id, session_id, turn_number, user_message, tutor_response, analysis_json, correction_given, correction_type, correction_reasoning) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(id, sessionId, turnNumber, userMessage, tutorResponse, analysisJson, correctionGiven ? 1 : 0, correctionType, correctionReasoning);
  return getDb().prepare("SELECT * FROM turns WHERE id = ?").get(id) as Turn;
}

export function updateSessionCounters(
  sessionId: string,
  errors: number,
  corrections: number,
  codeSwitches: number
): void {
  getWriteDb()
    .prepare(
      "UPDATE sessions SET total_turns = total_turns + 1, errors_detected = errors_detected + ?, corrections_given = corrections_given + ?, code_switches = code_switches + ? WHERE id = ?"
    )
    .run(errors, corrections, codeSwitches, sessionId);
}

export function upsertErrorPattern(
  learnerId: string,
  category: string,
  description: string,
  l1Source: string | null,
  severity: string,
  example: string,
  corrected: boolean
): void {
  const db = getWriteDb();
  const existing = getDb()
    .prepare("SELECT * FROM error_patterns WHERE learner_id = ? AND category = ? AND description = ?")
    .get(learnerId, category, description) as ErrorPattern | undefined;

  const n = now();
  if (existing) {
    let examples: string[];
    try { examples = JSON.parse(existing.example_utterances || "[]"); } catch { examples = []; }
    if (!examples.includes(example)) examples.push(example);
    const correctionsInc = corrected ? 1 : 0;
    const deferralsInc = corrected ? 0 : 1;
    const status = corrected && existing.times_corrected + correctionsInc >= 3 ? "improving" : existing.status;
    db.prepare(
      "UPDATE error_patterns SET occurrence_count = ?, last_seen = ?, times_corrected = times_corrected + ?, times_deferred = times_deferred + ?, status = ?, example_utterances = ? WHERE id = ?"
    ).run(existing.occurrence_count + 1, n, correctionsInc, deferralsInc, status, JSON.stringify(examples), existing.id);
  } else {
    db.prepare(
      "INSERT INTO error_patterns (id, learner_id, description, category, l1_source, severity, last_seen, times_corrected, times_deferred, example_utterances) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(uid(), learnerId, description, category, l1Source, severity, n, corrected ? 1 : 0, corrected ? 0 : 1, JSON.stringify([example]));
  }
}

export function upsertGrammar(
  learnerId: string,
  pattern: string,
  level: string | null,
  correct: boolean,
  example: string
): void {
  const db = getWriteDb();
  const n = now();
  const existing = getDb()
    .prepare("SELECT * FROM grammar_inventory WHERE learner_id = ? AND pattern = ?")
    .get(learnerId, pattern) as GrammarItem | undefined;

  if (existing) {
    let examples: string[];
    try { examples = JSON.parse(existing.example_sentences || "[]"); } catch { examples = []; }
    if (!examples.includes(example)) { examples.push(example); if (examples.length > 20) examples = examples.slice(-20); }
    const correctUses = existing.correct_uses + (correct ? 1 : 0);
    const incorrectUses = existing.incorrect_uses + (correct ? 0 : 1);
    const total = correctUses + incorrectUses;
    const mastery = total >= 3 ? (correctUses / total) * 100 : 0;
    db.prepare(
      "UPDATE grammar_inventory SET correct_uses = ?, incorrect_uses = ?, mastery_score = ?, last_used = ?, example_sentences = ? WHERE id = ?"
    ).run(correctUses, incorrectUses, mastery, n, JSON.stringify(examples), existing.id);
  } else {
    db.prepare(
      "INSERT INTO grammar_inventory (id, learner_id, pattern, level, correct_uses, incorrect_uses, mastery_score, first_used, last_used, example_sentences) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(uid(), learnerId, pattern, level, correct ? 1 : 0, correct ? 0 : 1, 0, n, n, JSON.stringify([example]));
  }
}

export function upsertVocabulary(learnerId: string, word: string, language: string): void {
  const db = getWriteDb();
  const n = now();
  const existing = getDb()
    .prepare("SELECT * FROM vocabulary WHERE learner_id = ? AND word = ? AND language = ?")
    .get(learnerId, word, language) as VocabItem | undefined;

  if (existing) {
    db.prepare("UPDATE vocabulary SET times_used = times_used + 1, last_used = ? WHERE id = ?").run(n, existing.id);
  } else {
    db.prepare("INSERT INTO vocabulary (id, learner_id, word, language, last_used) VALUES (?, ?, ?, ?, ?)").run(uid(), learnerId, word, language, n);
  }
}

export function markVocabUnknown(learnerId: string, word: string): void {
  const db = getWriteDb();
  const n = now();
  const existing = getDb()
    .prepare("SELECT * FROM vocabulary WHERE learner_id = ? AND word = ?")
    .get(learnerId, word) as VocabItem | undefined;

  if (existing) {
    db.prepare("UPDATE vocabulary SET language = 'unknown', last_used = ? WHERE id = ?").run(n, existing.id);
  } else {
    db.prepare("INSERT INTO vocabulary (id, learner_id, word, language, last_used) VALUES (?, ?, ?, 'unknown', ?)").run(uid(), learnerId, word, n);
  }
}

export function markVocabKnown(learnerId: string, word: string): void {
  const db = getWriteDb();
  const n = now();
  db.prepare("UPDATE vocabulary SET language = 'target', last_used = ? WHERE learner_id = ? AND word = ?").run(n, learnerId, word);
}

// ── Expressions (idioms, set phrases, grammar patterns in context) ──

export function upsertExpression(
  learnerId: string, expression: string, type: string,
  meaning: string | null, context: string | null, produced: boolean
): void {
  const db = getWriteDb();
  const n = now();
  const existing = getDb()
    .prepare("SELECT * FROM expressions WHERE learner_id = ? AND expression = ?")
    .get(learnerId, expression) as Expression | undefined;

  if (existing) {
    const newProduced = existing.times_produced + (produced ? 1 : 0);
    const newEncountered = existing.times_encountered + 1;
    // Auto-upgrade proficiency based on production
    let proficiency = existing.proficiency;
    if (produced && proficiency === "passive") proficiency = "emerging";
    if (newProduced >= 3 && proficiency === "emerging") proficiency = "active";
    if (newProduced >= 8) proficiency = "mastered";

    db.prepare(
      "UPDATE expressions SET times_encountered = ?, times_produced = ?, proficiency = ?, last_seen = ?, example_context = COALESCE(?, example_context) WHERE id = ?"
    ).run(newEncountered, newProduced, proficiency, n, context, existing.id);
  } else {
    db.prepare(
      "INSERT INTO expressions (id, learner_id, expression, type, meaning, example_context, proficiency, times_produced, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(uid(), learnerId, expression, type, meaning, context, produced ? "emerging" : "passive", produced ? 1 : 0, n);
  }
}

export function getExpressions(learnerId: string): Expression[] {
  return getDb()
    .prepare("SELECT * FROM expressions WHERE learner_id = ? ORDER BY proficiency ASC, times_encountered DESC")
    .all(learnerId) as Expression[];
}

export function updateExpressionProficiency(id: string, proficiency: string): void {
  getWriteDb().prepare("UPDATE expressions SET proficiency = ? WHERE id = ?").run(proficiency, id);
}

// ── Phrasing Suggestions ──

export function createPhrasingSuggestion(
  learnerId: string, sessionId: string | null, original: string,
  suggested: string, grammarPoint: string | null, explanation: string | null, category: string
): void {
  getWriteDb().prepare(
    "INSERT INTO phrasing_suggestions (id, learner_id, session_id, original, suggested, grammar_point, explanation, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(uid(), learnerId, sessionId, original, suggested, grammarPoint, explanation, category);
}

export function getPhrasingSuggestions(learnerId: string, limit = 20): PhrasingSuggestion[] {
  return getDb()
    .prepare("SELECT * FROM phrasing_suggestions WHERE learner_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(learnerId, limit) as PhrasingSuggestion[];
}

export function getWeakGrammar(learnerId: string): GrammarItem[] {
  return getDb()
    .prepare(
      "SELECT * FROM grammar_inventory WHERE learner_id = ? AND mastery_score < 50 AND (correct_uses + incorrect_uses) >= 3 ORDER BY mastery_score ASC LIMIT 10"
    )
    .all(learnerId) as GrammarItem[];
}

export function getActiveErrors(learnerId: string, limit = 10): ErrorPattern[] {
  return getDb()
    .prepare(
      "SELECT * FROM error_patterns WHERE learner_id = ? AND status != 'resolved' ORDER BY occurrence_count DESC LIMIT ?"
    )
    .all(learnerId, limit) as ErrorPattern[];
}

export function getRecentCorrections(sessionId: string, limit = 3): Turn[] {
  return getDb()
    .prepare(
      "SELECT * FROM turns WHERE session_id = ? AND correction_given = 1 ORDER BY turn_number DESC LIMIT ?"
    )
    .all(sessionId, limit) as Turn[];
}

export function getAvoidancePatterns(learnerId: string) {
  return getDb()
    .prepare("SELECT * FROM avoidance_patterns WHERE learner_id = ?")
    .all(learnerId);
}

/**
 * Compute effective difficulty level based on accumulated learner data.
 * Returns a level string (A1-C2) and a confidence score.
 */
export function computeEffectiveLevel(learnerId: string): {
  level: string;
  confidence: number;
  grammarMastery: number;
  errorRate: number;
  totalDataPoints: number;
} {
  const db = getDb();

  // Average grammar mastery (only items with enough data)
  const grammarStats = db
    .prepare(
      "SELECT AVG(mastery_score) as avg_mastery, COUNT(*) as cnt FROM grammar_inventory WHERE learner_id = ? AND (correct_uses + incorrect_uses) >= 3"
    )
    .get(learnerId) as { avg_mastery: number | null; cnt: number };

  // Recent error rate (last 10 sessions)
  const recentSessions = db
    .prepare(
      `SELECT total_turns, errors_detected FROM sessions
       WHERE learner_id = ? AND ended_at IS NOT NULL AND total_turns > 0
       ORDER BY started_at DESC LIMIT 10`
    )
    .all(learnerId) as Array<{ total_turns: number; errors_detected: number }>;

  let errorRate = 0;
  if (recentSessions.length > 0) {
    const totalTurns = recentSessions.reduce((s, r) => s + r.total_turns, 0);
    const totalErrors = recentSessions.reduce((s, r) => s + r.errors_detected, 0);
    errorRate = totalTurns > 0 ? (totalErrors / totalTurns) * 100 : 0;
  }

  const grammarMastery = grammarStats.avg_mastery ?? 0;
  const totalDataPoints = (grammarStats.cnt || 0) + recentSessions.length;

  // Confidence: how much data we have (0-1)
  const confidence = Math.min(1, totalDataPoints / 20);

  // Determine level based on mastery + error rate
  let level: string;
  if (grammarMastery >= 85 && errorRate < 10) level = "C1";
  else if (grammarMastery >= 70 && errorRate < 20) level = "B2";
  else if (grammarMastery >= 55 && errorRate < 35) level = "B1";
  else if (grammarMastery >= 35 && errorRate < 50) level = "A2";
  else level = "A1";

  return { level, confidence, grammarMastery, errorRate, totalDataPoints };
}

/**
 * Get practice items ordered by spaced repetition priority.
 * Items seen recently and corrected get lower priority.
 * Items seen long ago or never corrected get higher priority.
 */
export function getSpacedRepetitionItems(learnerId: string, limit = 5): Array<ErrorPattern & { priority: number }> {
  const errors = getDb()
    .prepare(
      `SELECT * FROM error_patterns
       WHERE learner_id = ? AND status != 'resolved'
       ORDER BY
         CASE WHEN last_seen IS NULL THEN 999
              ELSE julianday('now') - julianday(last_seen)
         END DESC,
         (occurrence_count - times_corrected) DESC,
         occurrence_count DESC
       LIMIT ?`
    )
    .all(learnerId, limit) as ErrorPattern[];

  return errors.map((e, i) => ({
    ...e,
    priority: limit - i, // higher = more important
  }));
}

/**
 * Get L1 interference patterns (errors with identified native language source).
 */
export function getL1Patterns(learnerId: string): ErrorPattern[] {
  return getDb()
    .prepare(
      "SELECT * FROM error_patterns WHERE learner_id = ? AND l1_source IS NOT NULL AND l1_source != '' ORDER BY occurrence_count DESC"
    )
    .all(learnerId) as ErrorPattern[];
}

export function getVocabGrowth(learnerId: string): Array<{ date: string; cumulative: number }> {
  return getDb()
    .prepare(
      `SELECT
        DATE(first_used) as date,
        COUNT(*) OVER (ORDER BY DATE(first_used)) as cumulative
      FROM vocabulary
      WHERE learner_id = ?
      GROUP BY DATE(first_used)
      ORDER BY date`
    )
    .all(learnerId) as Array<{ date: string; cumulative: number }>;
}

export function getSessionMetrics(learnerId: string, limit = 50): Array<{
  date: string;
  errorRate: number;
  turns: number;
  errors: number;
  corrections: number;
  duration: number;
}> {
  const sessions = getDb()
    .prepare(
      `SELECT started_at, total_turns, errors_detected, corrections_given, duration_seconds
       FROM sessions
       WHERE learner_id = ? AND ended_at IS NOT NULL AND total_turns > 0
       ORDER BY started_at ASC
       LIMIT ?`
    )
    .all(learnerId, limit) as Array<{
      started_at: string;
      total_turns: number;
      errors_detected: number;
      corrections_given: number;
      duration_seconds: number | null;
    }>;

  return sessions.map((s) => ({
    date: s.started_at?.slice(0, 10) ?? "",
    errorRate: s.total_turns > 0 ? Math.round((s.errors_detected / s.total_turns) * 100) : 0,
    turns: s.total_turns,
    errors: s.errors_detected,
    corrections: s.corrections_given,
    duration: Math.round((s.duration_seconds ?? 0) / 60),
  }));
}

// ── Learner Interests ──

export function getInterests(learnerId: string): LearnerInterest[] {
  return getDb()
    .prepare("SELECT * FROM learner_interests WHERE learner_id = ? ORDER BY mention_count DESC, last_mentioned DESC")
    .all(learnerId) as LearnerInterest[];
}

export function upsertInterest(
  learnerId: string,
  category: string,
  name: string,
  details: string | null,
  source: string,
  confidence: number
): void {
  const db = getWriteDb();
  const n = now();
  const normalizedName = name.toLowerCase().trim();
  const existing = getDb()
    .prepare("SELECT * FROM learner_interests WHERE learner_id = ? AND LOWER(name) = ?")
    .get(learnerId, normalizedName) as LearnerInterest | undefined;

  if (existing) {
    const newDetails = details && details !== existing.details
      ? [existing.details, details].filter(Boolean).join("; ")
      : existing.details;
    db.prepare(
      "UPDATE learner_interests SET mention_count = mention_count + 1, last_mentioned = ?, details = COALESCE(?, details), confidence = MAX(confidence, ?) WHERE id = ?"
    ).run(n, newDetails, confidence, existing.id);
  } else {
    db.prepare(
      "INSERT INTO learner_interests (id, learner_id, category, name, details, source, confidence, last_mentioned) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(uid(), learnerId, category, name, details, source, confidence, n);
  }
}

export function deleteInterest(id: string): void {
  getWriteDb().prepare("DELETE FROM learner_interests WHERE id = ?").run(id);
}

export function getCachedTopics(learnerId: string, limit = 10): TopicCache[] {
  return getDb()
    .prepare("SELECT * FROM topic_cache WHERE learner_id = ? AND used = 0 ORDER BY created_at DESC LIMIT ?")
    .all(learnerId, limit) as TopicCache[];
}

export function cacheTopics(learnerId: string, topics: Array<{ topic: string; context: string | null; webSnippet: string | null; sourceUrl: string | null; interestId: string | null }>): void {
  const db = getWriteDb();
  const stmt = db.prepare(
    "INSERT INTO topic_cache (id, learner_id, topic, context, web_snippet, source_url, interest_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  for (const t of topics) {
    stmt.run(uid(), learnerId, t.topic, t.context, t.webSnippet, t.sourceUrl, t.interestId);
  }
}

export function markTopicUsed(id: string): void {
  getWriteDb().prepare("UPDATE topic_cache SET used = 1 WHERE id = ?").run(id);
}
