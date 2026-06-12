#!/usr/bin/env node
/**
 * Permanent persistence probe (contract-002).
 *
 * Drives the REAL HTTP routes (session/start -> turn -> finish) against a
 * running dev server with a self-cleaning `harness-test-*` English->Japanese
 * learner, then asserts real rows landed in Supabase. Cleans up unconditionally.
 *
 * Usage (requires the dev server running on :3000 + live env):
 *   npm run probe:persistence
 *
 * Fail-loud injection (unreachable DB) — non-zero exit, no hang:
 *   NEXT_PUBLIC_SUPABASE_URL=https://invalid.example.invalid npm run probe:persistence
 *
 * Granular failure reasons: auth-failed | llm-failed | rows-missing:<table> | db-unreachable.
 *
 * SAFETY FENCE: creates exactly ONE learner, captures its id, scopes every
 * write/delete to that id, cleans up in a `finally`. Never touches a learner
 * it did not create. Never the production Vercel deployment.
 */

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE_URL = process.env.PROBE_BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const HARNESS_PREFIX = "harness-test-";

function fail(reason) {
  console.error(`PROBE FAIL: ${reason}`);
  process.exit(1);
}

function log(msg) {
  console.log(msg);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  fail(
    "db-unreachable — missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)"
  );
}

// Service-role client — used ONLY for the dedicated test learner: creation,
// row assertions, and scoped cleanup. Short network timeout so an unreachable
// host fails fast instead of hanging.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TIMEOUT_MS = 12000;

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`timeout after ${TIMEOUT_MS}ms (${label})`)),
        TIMEOUT_MS
      )
    ),
  ]);
}

// Sign in as the persistent harness-test user via @supabase/ssr against an
// in-memory cookie jar — the library serializes the session into the exact
// `sb-*` cookies the dev server's getAuthUserId() reads, so we forward them
// verbatim. Using a fixed admin-created user (password sign-in) instead of
// signInAnonymously avoids Supabase's low anonymous-sign-in rate limit.
const HARNESS_EMAIL = process.env.HARNESS_TEST_EMAIL;
const HARNESS_PASSWORD = process.env.HARNESS_TEST_PASSWORD;

async function mintGuestCookies() {
  if (!HARNESS_EMAIL || !HARNESS_PASSWORD) {
    throw new Error(
      "auth-failed — HARNESS_TEST_EMAIL / HARNESS_TEST_PASSWORD not set in .env"
    );
  }
  const jar = new Map();
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(list) {
        for (const { name, value } of list) jar.set(name, value);
      },
    },
  });
  const { data, error } = await withTimeout(
    client.auth.signInWithPassword({
      email: HARNESS_EMAIL,
      password: HARNESS_PASSWORD,
    }),
    "signInWithPassword"
  );
  if (error || !data?.user?.id) {
    throw new Error(`auth-failed — ${error?.message ?? "no harness user"}`);
  }
  return { userId: data.user.id, jar };
}

function cookieHeader(jar, extra = {}) {
  const parts = [...jar.entries()].map(([name, value]) => `${name}=${value}`);
  for (const [name, value] of Object.entries(extra)) {
    parts.push(`${name}=${encodeURIComponent(value)}`);
  }
  return parts.join("; ");
}

async function postJson(path, cookies, body) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
  } catch (err) {
    throw new Error(
      `request to ${path} failed (is the dev server running on ${BASE_URL}?): ${err?.message ?? err}`
    );
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json, text };
}

// A scripted multi-turn Japanese transcript: the learner produces some correct
// Japanese plus at least one error / unknown word, so the finish review has
// something to persist.
const SCRIPTED_TURNS = [
  {
    userMessage: "こんにちは。今日はいい天気ですね。",
    tutorResponse: "こんにちは！本当にいい天気ですね。今日は何をしましたか？",
  },
  {
    userMessage: "私は公園に行きました。でも「散歩」は何ですか？",
    tutorResponse:
      "「散歩」は英語で a walk です。公園を散歩しましたか？いいですね。",
  },
  {
    userMessage: "はい、公園で散歩しました。それから、ともだちと昼ごはんを食べりました。",
    tutorResponse:
      "楽しそうですね！小さい直し：「食べりました」ではなく「食べました」が正しいです。",
  },
];

function messagesFromTurns(turns) {
  const messages = [];
  for (const t of turns) {
    messages.push({ role: "user", content: t.userMessage });
    messages.push({ role: "assistant", content: t.tutorResponse });
  }
  return messages;
}

async function countRows(table, learnerId) {
  const { count, error } = await withTimeout(
    admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("learner_id", learnerId),
    `count ${table}`
  );
  if (error) throw new Error(`db-unreachable — count ${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  let learnerId = null;
  let createdLearner = false;
  const assertionFailures = [];

  try {
    // 1) Anonymous auth + dedicated test learner (English -> Japanese).
    const { userId, jar } = await mintGuestCookies();
    log(`auth: anonymous user ${userId}`);

    const name = `${HARNESS_PREFIX}persist-${Date.now()}`;
    const { data: learnerRow, error: createErr } = await withTimeout(
      admin
        .from("learners")
        .insert({
          id: crypto.randomUUID(),
          name,
          native_language: "English",
          target_language: "Japanese",
          proficiency_level: "A2",
          correction_tolerance: "medium",
          user_id: userId,
        })
        .select()
        .single(),
      "create learner"
    );
    if (createErr || !learnerRow?.id) {
      throw new Error(
        `db-unreachable — create learner: ${createErr?.message ?? "no row returned"}`
      );
    }
    learnerId = learnerRow.id;
    createdLearner = true;
    log(`created learner ${learnerId} (${name})`);

    const cookies = cookieHeader(jar, { active_learner: learnerId });

    // 2) Drive start -> turn x3 -> finish over the real HTTP routes.
    const startRes = await postJson("/api/session/start", cookies, {
      mode: "text",
    });
    if (startRes.status === 401) {
      throw new Error(`auth-failed — session/start returned 401`);
    }
    const sessionId = startRes.json?.sessionId;
    if (startRes.status !== 200 || !sessionId) {
      throw new Error(
        `session/start failed (status ${startRes.status}): ${startRes.text?.slice(0, 200)}`
      );
    }
    log(`session started ${sessionId}`);

    for (let i = 0; i < SCRIPTED_TURNS.length; i++) {
      const turnRes = await postJson("/api/session/turn", cookies, {
        sessionId,
        turnNumber: i + 1,
        userMessage: SCRIPTED_TURNS[i].userMessage,
        tutorResponse: SCRIPTED_TURNS[i].tutorResponse,
      });
      if (turnRes.status !== 200) {
        throw new Error(
          `session/turn ${i + 1} failed (status ${turnRes.status}): ${turnRes.text?.slice(0, 200)}`
        );
      }
    }
    log(`recorded ${SCRIPTED_TURNS.length} turns`);

    const finishRes = await postJson("/api/session/finish", cookies, {
      sessionId,
      messages: messagesFromTurns(SCRIPTED_TURNS),
    });
    if (finishRes.status !== 200) {
      throw new Error(
        `llm-failed — session/finish returned status ${finishRes.status}: ${finishRes.text?.slice(0, 200)}`
      );
    }
    const review = finishRes.json?.review;
    if (!review || typeof review.summary !== "string" || !review.summary.trim()) {
      throw new Error(
        `llm-failed — finish review missing/empty summary (Gemini call produced nothing usable)`
      );
    }
    log(`finish review summary: "${review.summary.slice(0, 80)}..."`);

    // 3) Assert real rows landed, scoped to this learner id.
    const { data: sessions, error: sessErr } = await withTimeout(
      admin
        .from("sessions")
        .select("id, total_turns, ended_at, summary")
        .eq("learner_id", learnerId)
        .not("ended_at", "is", null),
      "read sessions"
    );
    if (sessErr) {
      throw new Error(`db-unreachable — read sessions: ${sessErr.message}`);
    }

    const endedSessions = (sessions ?? []).filter(
      (s) =>
        s.ended_at &&
        (s.total_turns ?? 0) > 0 &&
        typeof s.summary === "string" &&
        s.summary.trim().length > 0
    );

    // turns are keyed by session_id, not learner_id — scope via this session.
    const turnsRes = await withTimeout(
      admin
        .from("turns")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId),
      "count turns"
    );
    if (turnsRes.error) {
      throw new Error(`db-unreachable — count turns: ${turnsRes.error.message}`);
    }

    const counts = {
      sessions: endedSessions.length,
      turns: turnsRes.count ?? 0,
      vocabulary: await countRows("vocabulary", learnerId),
      grammar_inventory: await countRows("grammar_inventory", learnerId),
      error_patterns: await countRows("error_patterns", learnerId),
    };

    log("");
    log("per-table row counts (scoped to probe learner):");
    log(`  sessions (ended, turns>0, summary): ${counts.sessions}  (expect >= 1)`);
    log(`  turns:                              ${counts.turns}  (expect >= 2)`);
    log(`  vocabulary:                         ${counts.vocabulary}  (expect >= 1)`);
    log(`  grammar_inventory:                  ${counts.grammar_inventory}  (expect >= 1)`);
    log(`  error_patterns:                     ${counts.error_patterns}  (expect >= 1)`);
    log("");

    const check = (table, got, min) => {
      if (got < min) {
        const line = `FAIL: ${table} expected >= ${min}, got ${got}`;
        console.error(line);
        assertionFailures.push(`rows-missing:${table}`);
      }
    };
    check("sessions", counts.sessions, 1);
    check("turns", counts.turns, 2);
    check("vocabulary", counts.vocabulary, 1);
    check("grammar_inventory", counts.grammar_inventory, 1);
    check("error_patterns", counts.error_patterns, 1);
  } catch (err) {
    // Map known phases to granular reasons; otherwise surface the raw message.
    const msg = err?.message ?? String(err);
    assertionFailures.push(msg);
  } finally {
    // 4) Cleanup — runs even on assertion failure. Fenced strictly to the
    //    single learner id we created. No global deletes.
    if (createdLearner && learnerId) {
      const deleted = await cleanup(learnerId);
      const remaining = await countHarnessLearners();
      log(
        `cleanup: deleted learner ${learnerId} + ${deleted} rows; harness-test-* learners remaining: ${remaining}`
      );
    } else {
      log("cleanup: no learner created — nothing to delete");
    }
  }

  if (assertionFailures.length > 0) {
    fail(assertionFailures.join(" | "));
  }
  log("PROBE PASS");
  process.exit(0);
}

// Delete every row created for this learner id, then the learner itself.
// Every delete carries a learner_id (or id) equality filter on the captured id.
async function cleanup(learnerId) {
  let deleted = 0;

  // turns are keyed by session_id — collect this learner's sessions first.
  const { data: sessionRows } = await admin
    .from("sessions")
    .select("id")
    .eq("learner_id", learnerId);
  const sessionIds = (sessionRows ?? []).map((s) => s.id);
  if (sessionIds.length > 0) {
    const { count } = await admin
      .from("turns")
      .delete({ count: "exact" })
      .in("session_id", sessionIds);
    deleted += count ?? 0;
  }

  const learnerScoped = [
    "sessions",
    "vocabulary",
    "grammar_inventory",
    "error_patterns",
    "expressions",
    "phrasing_suggestions",
    "learner_interests",
  ];
  for (const table of learnerScoped) {
    const { count } = await admin
      .from(table)
      .delete({ count: "exact" })
      .eq("learner_id", learnerId);
    deleted += count ?? 0;
  }

  const { count: learnerCount } = await admin
    .from("learners")
    .delete({ count: "exact" })
    .eq("id", learnerId);
  deleted += learnerCount ?? 0;

  return deleted;
}

async function countHarnessLearners() {
  const { count, error } = await admin
    .from("learners")
    .select("id", { count: "exact", head: true })
    .ilike("name", `${HARNESS_PREFIX}%`);
  if (error) return "unknown";
  return count ?? 0;
}

main().catch((err) => {
  fail(err?.message ?? String(err));
});
