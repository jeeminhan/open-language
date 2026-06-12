#!/usr/bin/env node
/**
 * Layer-2 review-quality eval harness (contract-003).
 *
 * For each labeled transcript in `evals/transcripts/*.json`, this runner:
 *   1. Mints an anonymous Supabase session and creates exactly ONE
 *      `harness-test-*` English->Japanese learner (id captured at creation).
 *   2. Drives the REAL HTTP routes `POST /api/session/start -> turn(s) ->
 *      finish` with the transcript's messages, capturing the returned
 *      `review` object (the contract-permitted QA-mode Gemini review).
 *   3. Scores the review against the transcript's `expect` block using a
 *      HYBRID scorer: rule-based substring matching first, then an LLM judge
 *      (a second Gemini call) for `fuzzy: true` expectations and as a fallback
 *      on any rule-based miss.
 *   4. Cleans up its learner + every scoped row in a `finally` (even on
 *      failure), so no `harness-test-*` learner is left behind.
 *
 * It writes a human-readable quality report to `evals/report-latest.md` with a
 * per-transcript ✓/✗ breakdown, judge-invocation lines, soft spurious/precision
 * notes, and an aggregate catch-rate. This is a REPORT, not a gate:
 *   - exit 0 whenever it could run end-to-end (even at 0% catch-rate);
 *   - exit non-zero ONLY when it cannot run (auth/db/transport failure, or
 *     `session/finish` unusable for ALL transcripts).
 *
 * Usage (dev server must be running; BASE_URL configurable):
 *   EVAL_BASE_URL=http://localhost:3007 npm run eval:review
 *
 * SAFETY FENCE: one captured learner id per transcript; every write/delete
 * scoped to that id; cleanup in try/finally; guest / `harness-test-*` only;
 * never the production Vercel deployment. The finish review + the judge are the
 * only permitted (QA-mode) LLM calls.
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const TRANSCRIPTS_DIR = path.join(REPO_ROOT, "evals", "transcripts");
const REPORT_PATH = path.join(REPO_ROOT, "evals", "report-latest.md");

const BASE_URL = process.env.EVAL_BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || "gemini-2.5-flash";
const HARNESS_PREFIX = "harness-test-";

function fatal(reason) {
  // "Cannot run" — non-zero exit per the contract (auth/db/transport).
  console.error(`EVAL CANNOT RUN: ${reason}`);
  process.exit(1);
}

function log(msg) {
  console.log(msg);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  fatal(
    "missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)"
  );
}

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

// ---------------------------------------------------------------------------
// Rule-based token matching. This duplicates the tiny, unit-tested helpers in
// `src/lib/reviewScore.ts` (the runner is plain ESM with no `@/` alias). The
// source of truth + the vitest coverage live there; keep these in sync.
// ---------------------------------------------------------------------------
function norm(value) {
  return typeof value === "string" ? value.trim() : "";
}

function tokenMatches(haystack, needle) {
  const n = norm(needle);
  if (!n) return false;
  const h = norm(haystack);
  if (!h) return false;
  return h.includes(n);
}

function scoreErrorExpectation(review, token) {
  const t = norm(token);
  if (!t) return false;
  const errors = Array.isArray(review.errors) ? review.errors : [];
  return errors.some(
    (err) =>
      tokenMatches(err?.observed, t) ||
      tokenMatches(err?.expected, t) ||
      tokenMatches(err?.pattern_description, t)
  );
}

function scoreUnknownExpectation(review, word) {
  const needle = norm(word);
  if (!needle) return false;
  const inUnknown = (Array.isArray(review.unknownWords) ? review.unknownWords : [])
    .some((item) => tokenMatches(item?.word, needle));
  const inSeen = (Array.isArray(review.vocabularySeen) ? review.vocabularySeen : [])
    .some((w) => tokenMatches(w, needle));
  const inQueued = (Array.isArray(review.queuedForLearning) ? review.queuedForLearning : [])
    .some((w) => tokenMatches(w, needle));
  return inUnknown || inSeen || inQueued;
}

function scoreGrammarExpectation(review, pattern) {
  const needle = norm(pattern);
  if (!needle) return false;
  const grammar = Array.isArray(review.grammarPracticed) ? review.grammarPracticed : [];
  return grammar.some((item) => tokenMatches(item?.pattern, needle));
}

function findSpuriousCatches(review, expect) {
  const errors = Array.isArray(review.errors) ? review.errors : [];
  const expectedTokens = (Array.isArray(expect.errors) ? expect.errors : [])
    .map((e) => norm(e?.token))
    .filter((t) => t.length > 0);
  const spurious = [];
  for (const err of errors) {
    const observed = norm(err?.observed);
    const expected = norm(err?.expected);
    const matches = expectedTokens.some(
      (token) =>
        tokenMatches(observed, token) ||
        tokenMatches(expected, token) ||
        tokenMatches(err?.pattern_description, token)
    );
    if (!matches) spurious.push({ observed, expected });
  }
  return spurious;
}

// ---------------------------------------------------------------------------
// Anonymous-auth cookie jar (same pattern as the persistence probe).
// ---------------------------------------------------------------------------
async function mintGuestCookies() {
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
    client.auth.signInAnonymously(),
    "signInAnonymously"
  );
  if (error || !data?.user?.id) {
    throw new Error(`auth-failed — ${error?.message ?? "no anonymous user"}`);
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

async function postJson(pathName, cookies, body) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${pathName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
  } catch (err) {
    throw new Error(
      `request to ${pathName} failed (is the dev server running on ${BASE_URL}?): ${err?.message ?? err}`
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

// ---------------------------------------------------------------------------
// LLM judge — a second Gemini call. Minimal prompt, thinkingBudget 0, single
// expectation per call, structured output per HARNESS.md conventions.
// ---------------------------------------------------------------------------
async function runJudge(transcriptMessages, expectationLabel, review) {
  if (!LLM_API_KEY) {
    return { caught: false, reason: "no LLM_API_KEY — judge unavailable" };
  }
  const transcript = transcriptMessages
    .map((m) => `${m.role === "user" ? "LEARNER" : "TUTOR"}: ${m.content}`)
    .join("\n");
  const reviewSlim = JSON.stringify({
    errors: review.errors,
    unknownWords: review.unknownWords,
    grammarPracticed: review.grammarPracticed,
    vocabularySeen: review.vocabularySeen,
    queuedForLearning: review.queuedForLearning,
  });
  const prompt = `You are grading whether an automated Japanese tutoring "review" caught ONE specific expected issue from a lesson transcript.

TRANSCRIPT:
${transcript}

EXPECTED ISSUE (did the review address THIS?):
${expectationLabel}

REVIEW OBJECT (JSON):
${reviewSlim}

Did the review catch / address the expected issue, even if worded differently (paraphrase counts)? Answer ONLY this JSON: {"caught": true|false, "reason": "one short sentence"}`;

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent?key=${LLM_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 200,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                caught: { type: "boolean" },
                reason: { type: "string" },
              },
              required: ["caught", "reason"],
            },
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
  } catch (err) {
    return { caught: false, reason: `judge call failed: ${err?.message ?? err}` };
  }
  if (!res.ok) {
    return { caught: false, reason: `judge HTTP ${res.status}` };
  }
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { caught: false, reason: "judge returned unparseable JSON" };
  }
  return {
    caught: parsed?.caught === true,
    reason: typeof parsed?.reason === "string" ? parsed.reason : "(no reason)",
  };
}

// ---------------------------------------------------------------------------
// Scoped cleanup — reuse the probe's shape, every delete filtered to the id.
// ---------------------------------------------------------------------------
async function cleanup(learnerId) {
  let deleted = 0;
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

function messagePairs(messages) {
  // Group consecutive user->assistant into turn pairs.
  const pairs = [];
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === "user" && messages[i + 1].role === "assistant") {
      pairs.push({
        userMessage: messages[i].content,
        tutorResponse: messages[i + 1].content,
      });
      i++;
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Drive one transcript end-to-end and capture its review. Throws on a "cannot
// run" condition (auth/transport/finish-failure) so the caller can decide
// whether ALL transcripts failed.
// ---------------------------------------------------------------------------
async function runTranscript(transcript, guest) {
  let learnerId = null;
  let createdLearner = false;
  let review = null;
  let runError = null;

  try {
    const { userId, jar } = guest;
    const name = `${HARNESS_PREFIX}eval-${transcript.name}-${Date.now()}`;
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

    const cookies = cookieHeader(jar, { active_learner: learnerId });

    const startRes = await postJson("/api/session/start", cookies, { mode: "text" });
    if (startRes.status === 401) throw new Error("auth-failed — session/start 401");
    const sessionId = startRes.json?.sessionId;
    if (startRes.status !== 200 || !sessionId) {
      throw new Error(
        `session/start failed (status ${startRes.status}): ${startRes.text?.slice(0, 160)}`
      );
    }

    const pairs = messagePairs(transcript.messages);
    for (let i = 0; i < pairs.length; i++) {
      const turnRes = await postJson("/api/session/turn", cookies, {
        sessionId,
        turnNumber: i + 1,
        userMessage: pairs[i].userMessage,
        tutorResponse: pairs[i].tutorResponse,
      });
      if (turnRes.status !== 200) {
        throw new Error(
          `session/turn ${i + 1} failed (status ${turnRes.status}): ${turnRes.text?.slice(0, 160)}`
        );
      }
    }

    const finishRes = await postJson("/api/session/finish", cookies, {
      sessionId,
      messages: transcript.messages,
    });
    if (finishRes.status !== 200) {
      throw new Error(
        `finish-failed — session/finish status ${finishRes.status}: ${finishRes.text?.slice(0, 160)}`
      );
    }
    review = finishRes.json?.review;
    if (!review || typeof review.summary !== "string") {
      throw new Error("finish-failed — review missing/unusable");
    }
  } catch (err) {
    runError = err?.message ?? String(err);
  } finally {
    if (createdLearner && learnerId) {
      try {
        await cleanup(learnerId);
      } catch (cleanupErr) {
        log(
          `  WARN cleanup failed for ${transcript.name} (learner ${learnerId}): ${cleanupErr?.message ?? cleanupErr}`
        );
      }
    }
  }

  return { review, runError };
}

// ---------------------------------------------------------------------------
// Score one transcript's review against its expect block (hybrid). Returns the
// rendered report block lines, per-expectation tallies, and judge lines.
// ---------------------------------------------------------------------------
async function scoreTranscript(transcript, review) {
  const expect = transcript.expect || {};
  const lines = [];
  const judgeLines = [];
  let caughtCount = 0;
  let totalCount = 0;
  let judgeCalls = 0;

  const mark = (ok) => (ok ? "✓ caught" : "✗ missed");

  // Error expectations.
  for (const errExp of Array.isArray(expect.errors) ? expect.errors : []) {
    totalCount++;
    const label = `error token "${errExp.token}"${errExp.fuzzy ? " (fuzzy)" : ""}`;
    let caught;
    let via;

    if (errExp.fuzzy) {
      // Judge always runs for fuzzy expectations.
      judgeCalls++;
      const verdict = await runJudge(
        transcript.messages,
        `error: ${errExp.token}`,
        review
      );
      caught = verdict.caught;
      via = "judge";
      const jline = `judge: ${transcript.name}/error:${errExp.token} → ${caught ? "caught" : "missed"} (${verdict.reason})`;
      judgeLines.push(jline);
    } else {
      caught = scoreErrorExpectation(review, errExp.token);
      via = "rule";
      if (!caught) {
        // Fallback judge on a rule-based miss.
        judgeCalls++;
        const verdict = await runJudge(
          transcript.messages,
          `error: ${errExp.token}`,
          review
        );
        const jline = `judge: ${transcript.name}/error:${errExp.token} → ${verdict.caught ? "caught" : "missed"} (fallback on rule-miss; ${verdict.reason})`;
        judgeLines.push(jline);
        if (verdict.caught) {
          caught = true;
          via = "judge-fallback";
        }
      }
    }
    if (caught) caughtCount++;
    lines.push(`  - ${mark(caught)} — ${label} [${via}]`);
  }

  // Unknown-word expectations (rule-based, judge fallback on miss).
  for (const word of Array.isArray(expect.unknownWords) ? expect.unknownWords : []) {
    totalCount++;
    let caught = scoreUnknownExpectation(review, word);
    let via = "rule";
    if (!caught) {
      judgeCalls++;
      const verdict = await runJudge(
        transcript.messages,
        `unknown word the learner did not know: ${word}`,
        review
      );
      const jline = `judge: ${transcript.name}/unknown:${word} → ${verdict.caught ? "caught" : "missed"} (fallback on rule-miss; ${verdict.reason})`;
      judgeLines.push(jline);
      if (verdict.caught) {
        caught = true;
        via = "judge-fallback";
      }
    }
    if (caught) caughtCount++;
    lines.push(`  - ${mark(caught)} — unknown word "${word}" [${via}]`);
  }

  // Grammar expectations (rule-based, judge fallback on miss).
  for (const pattern of Array.isArray(expect.grammar) ? expect.grammar : []) {
    totalCount++;
    let caught = scoreGrammarExpectation(review, pattern);
    let via = "rule";
    if (!caught) {
      judgeCalls++;
      const verdict = await runJudge(
        transcript.messages,
        `grammar point practiced: ${pattern}`,
        review
      );
      const jline = `judge: ${transcript.name}/grammar:${pattern} → ${verdict.caught ? "caught" : "missed"} (fallback on rule-miss; ${verdict.reason})`;
      judgeLines.push(jline);
      if (verdict.caught) {
        caught = true;
        via = "judge-fallback";
      }
    }
    if (caught) caughtCount++;
    lines.push(`  - ${mark(caught)} — grammar "${pattern}" [${via}]`);
  }

  // Soft spurious / precision note (never a hard failure).
  const spurious = findSpuriousCatches(review, expect);
  const noErrorsGuard = expect.noErrors === true;

  return {
    lines,
    judgeLines,
    caughtCount,
    totalCount,
    judgeCalls,
    spurious,
    noErrorsGuard,
  };
}

function spuriousBlock(spurious, noErrorsGuard) {
  if (spurious.length === 0) {
    return noErrorsGuard
      ? ["  spurious / precision: none — guard transcript clean (review flagged no fabricated errors)."]
      : ["  spurious / precision: none."];
  }
  const head = noErrorsGuard
    ? "  spurious / precision (SOFT — guard transcript, any flag is a precision note, never a missed expectation):"
    : "  spurious / precision (SOFT — review flagged an issue matching no planted expectation):";
  const items = spurious.map(
    (s) => `    · "${s.observed}" → "${s.expected}"`
  );
  return [head, ...items];
}

async function main() {
  // Load transcripts.
  let files;
  try {
    files = (await readdir(TRANSCRIPTS_DIR))
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch (err) {
    fatal(`cannot read transcripts dir ${TRANSCRIPTS_DIR}: ${err?.message ?? err}`);
  }
  if (!files || files.length === 0) {
    fatal(`no transcripts found in ${TRANSCRIPTS_DIR}`);
  }

  const transcripts = [];
  for (const file of files) {
    const raw = await readFile(path.join(TRANSCRIPTS_DIR, file), "utf8");
    try {
      const parsed = JSON.parse(raw);
      transcripts.push(parsed);
    } catch (err) {
      fatal(`transcript ${file} is not valid JSON: ${err?.message ?? err}`);
    }
  }

  log(`Eval base URL: ${BASE_URL}`);
  log(`Transcripts: ${transcripts.length}`);

  // Mint ONE anonymous guest session and reuse it across transcripts (each
  // transcript still creates + cleans its OWN captured learner id). Reusing the
  // session avoids Supabase's signInAnonymously rate limit. If this fails, no
  // transcript can run — that is a "cannot run" condition.
  let guest;
  try {
    guest = await mintGuestCookies();
    log(`Guest session: anonymous user ${guest.userId}`);
  } catch (err) {
    fatal(`could not mint anonymous guest session: ${err?.message ?? err}`);
  }

  const reportBlocks = [];
  const allJudgeLines = [];
  let aggCaught = 0;
  let aggTotal = 0;
  let totalJudgeCalls = 0;
  let ranCount = 0;
  let failedCount = 0;

  for (const transcript of transcripts) {
    log(`\n→ ${transcript.name}`);
    const { review, runError } = await runTranscript(transcript, guest);

    if (runError || !review) {
      failedCount++;
      log(`  FAILED to run: ${runError}`);
      reportBlocks.push(
        [
          `### ${transcript.name}`,
          `_${transcript.description}_`,
          "",
          `  ⚠ could not run this transcript: ${runError}`,
          "",
        ].join("\n")
      );
      continue;
    }

    ranCount++;
    const scored = await scoreTranscript(transcript, review);
    aggCaught += scored.caughtCount;
    aggTotal += scored.totalCount;
    totalJudgeCalls += scored.judgeCalls;
    allJudgeLines.push(...scored.judgeLines);

    const pct = scored.totalCount
      ? Math.round((scored.caughtCount / scored.totalCount) * 100)
      : 100;
    log(
      `  ${scored.caughtCount}/${scored.totalCount} caught (${pct}%), ${scored.judgeCalls} judge call(s)`
    );

    const block = [
      `### ${transcript.name}`,
      `_${transcript.description}_`,
      "",
      `  per-expectation: ${scored.caughtCount}/${scored.totalCount} caught (${pct}%)`,
      ...(scored.lines.length ? scored.lines : ["  (no planted expectations)"]),
      ...spuriousBlock(scored.spurious, scored.noErrorsGuard),
      ...(scored.judgeLines.length ? ["", "  judge invocations:", ...scored.judgeLines.map((l) => `  ${l}`)] : []),
      "",
    ];
    reportBlocks.push(block.join("\n"));
  }

  // If EVERY transcript failed to run, that is a "cannot run" condition.
  if (ranCount === 0) {
    // Still confirm cleanup left nothing behind before we exit non-zero.
    const remaining = await countHarnessLearners();
    log(`\nharness-test-* learners remaining: ${remaining}`);
    fatal(`all ${transcripts.length} transcripts failed to run (server/LLM unusable)`);
  }

  const aggPct = aggTotal ? Math.round((aggCaught / aggTotal) * 100) : 0;
  const remaining = await countHarnessLearners();

  const header = [
    "# Review-quality eval report (Layer 2)",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${BASE_URL}`,
    `Model: ${LLM_MODEL}`,
    "",
    "> This is a quality REPORT, not a gate. A low catch-rate is information,",
    "> not a failure. Read the per-transcript breakdown below to judge how well",
    "> `session/finish`'s LLM review catches planted errors / unknown words /",
    "> grammar. Spurious flags are a SOFT precision signal, never a hard miss.",
    "",
    `**Aggregate catch-rate: ${aggCaught}/${aggTotal} (${aggPct}%)**`,
    `Transcripts run: ${ranCount}/${transcripts.length}` +
      (failedCount ? ` (${failedCount} failed to run)` : ""),
    `Total LLM judge calls this run: ${totalJudgeCalls}`,
    `harness-test-* learners remaining: ${remaining}`,
    "",
    "---",
    "",
  ].join("\n");

  const judgeSummary = allJudgeLines.length
    ? [
        "## Judge invocations (all)",
        "",
        ...allJudgeLines.map((l) => `${l}`),
        "",
        "---",
        "",
      ].join("\n")
    : "";

  const body = ["## Per-transcript breakdown", "", ...reportBlocks].join("\n");

  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, header + judgeSummary + body, "utf8");

  log("");
  log(`Aggregate catch-rate: ${aggCaught}/${aggTotal} (${aggPct}%)`);
  log(`Report written: ${REPORT_PATH}`);
  log(`Total LLM judge calls this run: ${totalJudgeCalls}`);
  log(`harness-test-* learners remaining: ${remaining}`);

  // REPORT, not a gate: exit 0 on a reachable stack regardless of catch-rate.
  process.exit(0);
}

main().catch((err) => {
  // Any unexpected throw that escapes main() is a "cannot run" condition.
  fatal(err?.message ?? String(err));
});
