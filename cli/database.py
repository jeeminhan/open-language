"""SQLite database setup and CRUD operations."""

import json
import sqlite3
import uuid
from datetime import datetime
from typing import Any

import config


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = _connect()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS learners (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            native_language TEXT NOT NULL,
            target_language TEXT NOT NULL,
            proficiency_level TEXT,
            correction_tolerance TEXT DEFAULT 'moderate',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            learner_id TEXT REFERENCES learners(id),
            mode TEXT DEFAULT 'text',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP,
            duration_seconds INTEGER,
            total_turns INTEGER DEFAULT 0,
            errors_detected INTEGER DEFAULT 0,
            corrections_given INTEGER DEFAULT 0,
            code_switches INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS turns (
            id TEXT PRIMARY KEY,
            session_id TEXT REFERENCES sessions(id),
            turn_number INTEGER,
            user_message TEXT NOT NULL,
            tutor_response TEXT NOT NULL,
            user_audio_path TEXT,
            language_detected TEXT,
            whisper_confidence REAL,
            analysis_json TEXT,
            correction_given BOOLEAN DEFAULT FALSE,
            correction_type TEXT,
            correction_reasoning TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS error_patterns (
            id TEXT PRIMARY KEY,
            learner_id TEXT REFERENCES learners(id),
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            l1_source TEXT,
            severity TEXT DEFAULT 'medium',
            first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP,
            occurrence_count INTEGER DEFAULT 1,
            times_corrected INTEGER DEFAULT 0,
            times_deferred INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            example_utterances TEXT
        );

        CREATE TABLE IF NOT EXISTS grammar_inventory (
            id TEXT PRIMARY KEY,
            learner_id TEXT REFERENCES learners(id),
            pattern TEXT NOT NULL,
            level TEXT,
            correct_uses INTEGER DEFAULT 0,
            incorrect_uses INTEGER DEFAULT 0,
            mastery_score REAL DEFAULT 0.0,
            l1_interference BOOLEAN DEFAULT FALSE,
            first_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used TIMESTAMP,
            example_sentences TEXT
        );

        CREATE TABLE IF NOT EXISTS vocabulary (
            id TEXT PRIMARY KEY,
            learner_id TEXT REFERENCES learners(id),
            word TEXT NOT NULL,
            reading TEXT,
            language TEXT NOT NULL,
            times_used INTEGER DEFAULT 1,
            times_used_correctly INTEGER DEFAULT 1,
            first_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS fluency_snapshots (
            id TEXT PRIMARY KEY,
            session_id TEXT REFERENCES sessions(id),
            learner_id TEXT REFERENCES learners(id),
            avg_utterance_length REAL,
            hesitation_count INTEGER,
            self_correction_count INTEGER,
            code_switch_count INTEGER,
            unique_words_used INTEGER,
            grammar_variety_score REAL,
            article_accuracy REAL,
            tense_accuracy REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS avoidance_patterns (
            id TEXT PRIMARY KEY,
            learner_id TEXT REFERENCES learners(id),
            description TEXT NOT NULL,
            evidence TEXT,
            suggested_practice TEXT,
            first_noticed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS annotations (
            id TEXT PRIMARY KEY,
            turn_id TEXT REFERENCES turns(id),
            quality_score INTEGER,
            ideal_response TEXT,
            ideal_correction_action TEXT,
            notes TEXT,
            annotated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    conn.close()


def _uid() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now().isoformat()


# ── Learner CRUD ──────────────────────────────────────────

def get_learner() -> dict[str, Any] | None:
    conn = _connect()
    row = conn.execute("SELECT * FROM learners LIMIT 1").fetchone()
    conn.close()
    return dict(row) if row else None


def create_learner(name: str, native_language: str, target_language: str,
                   proficiency_level: str = "A2",
                   correction_tolerance: str = "moderate") -> dict[str, Any]:
    learner_id = _uid()
    conn = _connect()
    conn.execute(
        "INSERT INTO learners (id, name, native_language, target_language, proficiency_level, correction_tolerance) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (learner_id, name, native_language, target_language, proficiency_level, correction_tolerance),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM learners WHERE id = ?", (learner_id,)).fetchone()
    conn.close()
    return dict(row)


# ── Session CRUD ──────────────────────────────────────────

def create_session(learner_id: str, mode: str = "text") -> dict[str, Any]:
    session_id = _uid()
    conn = _connect()
    conn.execute(
        "INSERT INTO sessions (id, learner_id, mode, started_at) VALUES (?, ?, ?, ?)",
        (session_id, learner_id, mode, _now()),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row)


def end_session(session_id: str) -> dict[str, Any]:
    conn = _connect()
    now = _now()
    # Calculate duration using DB server time to avoid UTC/local mismatch
    conn.execute(
        "UPDATE sessions SET ended_at = ?, "
        "duration_seconds = CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER) "
        "WHERE id = ?",
        (now, now, session_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row)


def update_session_counters(session_id: str, errors: int = 0, corrections: int = 0,
                             code_switches: int = 0) -> None:
    conn = _connect()
    conn.execute(
        "UPDATE sessions SET total_turns = total_turns + 1, "
        "errors_detected = errors_detected + ?, "
        "corrections_given = corrections_given + ?, "
        "code_switches = code_switches + ? "
        "WHERE id = ?",
        (errors, corrections, code_switches, session_id),
    )
    conn.commit()
    conn.close()


def get_session_count(learner_id: str) -> int:
    conn = _connect()
    row = conn.execute("SELECT COUNT(*) as cnt FROM sessions WHERE learner_id = ?", (learner_id,)).fetchone()
    conn.close()
    return row["cnt"]


def get_recent_sessions(learner_id: str, limit: int = 5) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM sessions WHERE learner_id = ? ORDER BY started_at DESC LIMIT ?",
        (learner_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_total_practice_seconds(learner_id: str) -> int:
    conn = _connect()
    row = conn.execute(
        "SELECT COALESCE(SUM(duration_seconds), 0) as total FROM sessions WHERE learner_id = ?",
        (learner_id,),
    ).fetchone()
    conn.close()
    return row["total"]


# ── Turn CRUD ─────────────────────────────────────────────

def create_turn(session_id: str, turn_number: int, user_message: str,
                tutor_response: str, analysis_json: str | None = None,
                correction_given: bool = False, correction_type: str | None = None,
                correction_reasoning: str | None = None) -> dict[str, Any]:
    turn_id = _uid()
    conn = _connect()
    conn.execute(
        "INSERT INTO turns (id, session_id, turn_number, user_message, tutor_response, "
        "analysis_json, correction_given, correction_type, correction_reasoning) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (turn_id, session_id, turn_number, user_message, tutor_response,
         analysis_json, correction_given, correction_type, correction_reasoning),
    )
    conn.commit()
    conn.close()
    return {"id": turn_id, "turn_number": turn_number}


def get_session_turns(session_id: str) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM turns WHERE session_id = ? ORDER BY turn_number",
        (session_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_recent_corrections(session_id: str, limit: int = 3) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM turns WHERE session_id = ? AND correction_given = 1 "
        "ORDER BY turn_number DESC LIMIT ?",
        (session_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Error Patterns ────────────────────────────────────────

def find_error_pattern(learner_id: str, category: str, description: str) -> dict | None:
    conn = _connect()
    row = conn.execute(
        "SELECT * FROM error_patterns WHERE learner_id = ? AND category = ? AND description = ?",
        (learner_id, category, description),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def upsert_error_pattern(learner_id: str, category: str, description: str,
                          l1_source: str | None, severity: str,
                          example: str, corrected: bool) -> None:
    existing = find_error_pattern(learner_id, category, description)
    conn = _connect()
    now = _now()

    if existing:
        examples = json.loads(existing["example_utterances"] or "[]")
        if example not in examples:
            examples.append(example)
        corrections_inc = 1 if corrected else 0
        deferrals_inc = 0 if corrected else 1
        new_count = existing["occurrence_count"] + 1
        status = existing["status"]
        if corrected and existing["times_corrected"] + corrections_inc >= 3:
            status = "improving"
        conn.execute(
            "UPDATE error_patterns SET occurrence_count = ?, last_seen = ?, "
            "times_corrected = times_corrected + ?, times_deferred = times_deferred + ?, "
            "status = ?, example_utterances = ? WHERE id = ?",
            (new_count, now, corrections_inc, deferrals_inc, status,
             json.dumps(examples), existing["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO error_patterns (id, learner_id, description, category, l1_source, "
            "severity, last_seen, times_corrected, times_deferred, example_utterances) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (_uid(), learner_id, description, category, l1_source, severity,
             now, 1 if corrected else 0, 0 if corrected else 1,
             json.dumps([example])),
        )
    conn.commit()
    conn.close()


def get_active_errors(learner_id: str, limit: int = 10) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM error_patterns WHERE learner_id = ? AND status != 'resolved' "
        "ORDER BY occurrence_count DESC LIMIT ?",
        (learner_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_errors(learner_id: str) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM error_patterns WHERE learner_id = ? ORDER BY occurrence_count DESC",
        (learner_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Grammar Inventory ─────────────────────────────────────

def upsert_grammar(learner_id: str, pattern: str, level: str | None,
                    correct: bool, example: str) -> None:
    conn = _connect()
    now = _now()
    row = conn.execute(
        "SELECT * FROM grammar_inventory WHERE learner_id = ? AND pattern = ?",
        (learner_id, pattern),
    ).fetchone()

    if row:
        existing = dict(row)
        examples = json.loads(existing["example_sentences"] or "[]")
        if example not in examples:
            examples.append(example)
            if len(examples) > 20:
                examples = examples[-20:]
        correct_uses = existing["correct_uses"] + (1 if correct else 0)
        incorrect_uses = existing["incorrect_uses"] + (0 if correct else 1)
        total = correct_uses + incorrect_uses
        mastery = (correct_uses / total * 100) if total >= 3 else 0.0
        conn.execute(
            "UPDATE grammar_inventory SET correct_uses = ?, incorrect_uses = ?, "
            "mastery_score = ?, last_used = ?, example_sentences = ? WHERE id = ?",
            (correct_uses, incorrect_uses, mastery, now, json.dumps(examples), existing["id"]),
        )
    else:
        mastery = 0.0
        conn.execute(
            "INSERT INTO grammar_inventory (id, learner_id, pattern, level, correct_uses, "
            "incorrect_uses, mastery_score, first_used, last_used, example_sentences) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (_uid(), learner_id, pattern, level,
             1 if correct else 0, 0 if correct else 1,
             mastery, now, now, json.dumps([example])),
        )
    conn.commit()
    conn.close()


def get_weak_grammar(learner_id: str, threshold: float = 50.0) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM grammar_inventory WHERE learner_id = ? AND mastery_score < ? "
        "AND (correct_uses + incorrect_uses) >= 3 ORDER BY mastery_score ASC",
        (learner_id, threshold),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_grammar(learner_id: str) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM grammar_inventory WHERE learner_id = ? ORDER BY mastery_score ASC",
        (learner_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Vocabulary ────────────────────────────────────────────

def upsert_vocabulary(learner_id: str, word: str, language: str) -> None:
    conn = _connect()
    now = _now()
    row = conn.execute(
        "SELECT * FROM vocabulary WHERE learner_id = ? AND word = ? AND language = ?",
        (learner_id, word, language),
    ).fetchone()
    if row:
        conn.execute(
            "UPDATE vocabulary SET times_used = times_used + 1, last_used = ? WHERE id = ?",
            (now, row["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO vocabulary (id, learner_id, word, language, last_used) "
            "VALUES (?, ?, ?, ?, ?)",
            (_uid(), learner_id, word, language, now),
        )
    conn.commit()
    conn.close()


def get_vocabulary_stats(learner_id: str) -> dict:
    conn = _connect()
    total = conn.execute(
        "SELECT COUNT(*) as cnt FROM vocabulary WHERE learner_id = ?", (learner_id,)
    ).fetchone()["cnt"]
    most_used = conn.execute(
        "SELECT word, times_used FROM vocabulary WHERE learner_id = ? ORDER BY times_used DESC LIMIT 10",
        (learner_id,),
    ).fetchall()
    conn.close()
    return {"total_unique": total, "most_used": [dict(r) for r in most_used]}


# ── Avoidance Patterns ────────────────────────────────────

def get_avoidance_patterns(learner_id: str) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM avoidance_patterns WHERE learner_id = ?", (learner_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Annotations ───────────────────────────────────────────

def create_annotation(turn_id: str, quality_score: int,
                       ideal_response: str | None = None,
                       ideal_correction_action: str | None = None,
                       notes: str | None = None) -> None:
    conn = _connect()
    conn.execute(
        "INSERT INTO annotations (id, turn_id, quality_score, ideal_response, "
        "ideal_correction_action, notes) VALUES (?, ?, ?, ?, ?, ?)",
        (_uid(), turn_id, quality_score, ideal_response, ideal_correction_action, notes),
    )
    conn.commit()
    conn.close()


def get_total_turns(learner_id: str) -> int:
    conn = _connect()
    row = conn.execute(
        "SELECT COUNT(*) as cnt FROM turns t "
        "JOIN sessions s ON t.session_id = s.id "
        "WHERE s.learner_id = ?",
        (learner_id,),
    ).fetchone()
    conn.close()
    return row["cnt"]


def get_last_turn(session_id: str) -> dict | None:
    conn = _connect()
    row = conn.execute(
        "SELECT * FROM turns WHERE session_id = ? ORDER BY turn_number DESC LIMIT 1",
        (session_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None
