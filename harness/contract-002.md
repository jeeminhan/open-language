# Contract 002 — Verify memory persistence end-to-end + make a dead DB fail loudly (P0)

Backlog item: **2. Verify memory persistence end-to-end (P0)** — "The 'nothing commits to the database' complaint. `session/finish` runs 6 LLM passes then persists vocab/errors/grammar — but every write is wrapped in `.catch(() => null)`, so failures vanish. Instrument: collect per-write outcomes in `session/finish` and return a `persisted: {vocab: n, errors: n, grammar: n, failed: [...]}` summary; show counts in the recap. Check the `isSupportedLearner` guard in `db.ts` — confirm it isn't silently dropping writes for valid learners. QA criteria: drive a session via API with a fixture transcript; assert rows actually appear (vocab/errors/grammar counts > 0) and the dashboard reflects them."

Plus the out-of-contract QA finding it now absorbs: **DB was paused (2026-06-12)** — "the Supabase project had auto-paused (NXDOMAIN) — the actual root cause of 'nothing commits to the database.' If it pauses again, the whole app's persistence dies silently (writes are `.catch(() => null)`). Consider a startup health check that surfaces an unreachable DB instead of swallowing it."

Background the orchestrator verified MANUALLY today (the behavior to lock in permanently): a real guest call wrote correctly to Supabase — `sessions` (total_turns, ended_at, summary), `turns` (all utterances), `vocabulary` (incl. a `markVocabUnknown` word at `srs_state` "learning"), `grammar_inventory` (pattern/correct_uses/incorrect_uses/mastery_score), `error_patterns` (description/category/severity/occurrence_count). **Persistence WORKS when the DB is up.** The failure mode that bit the user was a PAUSED Supabase project: every write failed, nothing surfaced, and an empty dashboard looked identical to a healthy-but-new account.

## Goal
Lock persistence in with a permanent, runnable probe that drives `session/start → turn → finish` against the real DB and asserts rows actually land for a self-cleaning `harness-test-*` learner, and make a paused/unreachable database fail loudly — a `/api/health` endpoint that reports DB up/down and a dashboard that visibly distinguishes "database unreachable" from "no data yet."

## Resolved decisions (orchestrator, 2026-06-12)
- **Probe transport = real HTTP routes.** The probe drives the actual `/api/session/start → /api/session/turn → /api/session/finish` HTTP endpoints (not the `db.ts` write functions directly). Rationale: the persistence *orchestration* (Gemini review + the write loop) lives in `session/finish/route.ts`, so the db-layer path would have to duplicate route logic and drift. contract-001's QA already proved this exact path is drivable headlessly (anon sign-in → cookies → `/api/session/*`). The probe must emit **granular** failure reasons — distinguish `auth-failed` / `llm-failed` / `rows-missing:<table>` / `db-unreachable` — so a failure is diagnosable, never a black-box "PROBE FAIL".
- **Runner = `scripts/probe-persistence.mjs`** (plain ESM, not `.ts`). Since transport is HTTP, the probe needs no `src/lib` imports and no `@/` alias resolution — just `fetch` against `http://localhost:3000` plus `@supabase/supabase-js` (already a dependency) for anonymous sign-in and the cleanup/assertion queries (service-role key for cleanup, scoped to the created learner id). **Zero new dependencies**, no TS runner needed. Document `npm run probe:persistence` and that it requires the dev server running + live env.
- **Unreachable-DB injection = restart-free dev-only toggle**, mirroring contract-001's `x-harness-force-llm-fail`. Add `x-harness-force-db-down: 1` (honored only when `NODE_ENV !== "production"`) that drives `/api/health` to the down path, and a parallel restart-free way for the dashboard (C8) to render its unreachable state (e.g. the dashboard's health check respecting the same toggle, or a `?forceDbDown=1` dev-only query param). The evaluator must not need to restart the orchestrator's dev server.

## Scope (files that may change)

### Part A — permanent persistence probe
- `scripts/probe-persistence.mjs` (new — plain ESM per Resolved decisions; drives real HTTP routes) — a standalone runnable probe. It MUST, in order:
  1. Create a dedicated, clearly-named test learner whose `name` starts with `harness-test-` (e.g. `harness-test-persist-<timestamp>`), language pair **English → Japanese** (required — `isSupportedLearner` only accepts that pair; any other pair is silently dropped by reads), under a guest/anonymous auth user.
  2. Drive `session/start` → 2–3 `session/turn` → `session/finish` for that learner with a scripted multi-turn Japanese transcript (a fixed `{role,content}[]` fixture; the learner produces some correct Japanese and at least one error/unknown word so the review has something to persist). The `finish` review hits Gemini — **this is the contract-permitted QA-mode LLM call.**
  3. Query Supabase and ASSERT that rows landed for that learner in **sessions** (1 ended session with `total_turns > 0`, `ended_at` set, non-empty `summary`), **turns** (≥ 2), **vocabulary** (≥ 1), **grammar_inventory** (≥ 1), **error_patterns** (≥ 1). Each missing/zero assertion prints a clear `FAIL: <table> expected ≥ N, got M` line.
  4. CLEAN UP unconditionally (even on assertion failure — use try/finally): delete every row it created (turns, session, vocabulary, grammar_inventory, error_patterns, expressions, phrasing_suggestions, learner_interests for that learner) **and** the test learner row itself. Cleanup is fenced to the single learner id it created; it must never touch any other learner's data.
  5. Exit `0` only if every assertion passed; exit non-zero with a one-line human-readable reason otherwise (including the case where the DB is unreachable / `start` itself fails). Print a final `PROBE PASS` / `PROBE FAIL: <reason>` line.
- `package.json` — add a script (e.g. `"probe:persistence"`) that runs the probe with env loaded (mirror the existing `gen:demo-audio` pattern: `node --env-file=.env --env-file-if-exists=.env.local ...`). **This is NOT added to `npm test`** and is NOT part of the default gate — it needs a live DB and a real LLM call. Document the run command and its requirements in `harness/generator-state.md`.
- Transport is settled in **Resolved decisions**: drive the real HTTP routes (mint an anonymous Supabase session + `active_learner` cookie, as contract-001's QA did), and assert on real persisted rows via service-role reads. The probe must (i) run a real Gemini finish-review pass over the scripted transcript and (ii) assert on real persisted rows. Emit granular failure reasons (`auth-failed` / `llm-failed` / `rows-missing:<table>` / `db-unreachable`).

### Part B — DB-unreachable health surface
- `src/lib/health.ts` (new) — pure, unit-testable helpers:
  - a `formatHealthResult(...)` (or similarly named) function that maps a raw probe outcome `{ ok: boolean; error?: string; latencyMs?: number }` → the JSON body and HTTP status the route returns (e.g. `ok` → `{ status: "up", ... }` / 200, not-ok → `{ status: "down", error, ... }` / 503). This is the Layer-1 unit-tested helper.
  - keep the **actual** Supabase ping (a cheap `head`/`count` query with a short timeout) in this module too, but as a thin separate function the route calls; the pure formatter must not require a live DB.
- `src/app/(app)/api/health/route.ts` (new) — `GET` handler that pings Supabase via the `src/lib/health.ts` ping, runs the result through `formatHealthResult`, and returns it. Returns 200 + `status: "up"` when the DB answers, a non-200 (503) + `status: "down"` + an error string when it does not. No auth required (it is a health probe) — but it must NOT leak secrets in the error string (return the error message/class, never connection strings or keys).
- `src/lib/db.ts` — add ONE lightweight read used by the dashboard to distinguish "unreachable" from "empty": a `checkDbReachable()` (or fold reachability into a small wrapper) that runs a cheap query and returns `{ reachable: boolean; error?: string }` **without** the existing `data ?? []` swallowing. Do NOT rip out the existing `.catch`/`data ?? []` best-effort patterns elsewhere — the goal is surfacing on the primary read surface, not a rewrite of every query.
- `src/app/(app)/dashboard/page.tsx` — before (or alongside) the existing learner/stats load, check DB reachability. When the DB is unreachable, render a visibly distinct banner carrying `data-testid="db-unreachable-banner"` (e.g. "Can't reach the database right now — your progress isn't loading. This is a connection problem, not an empty account.") that is clearly different from the existing "No learner profile found" empty state. **Add `data-testid="no-learner-state"` to that existing empty `<p>`** so the two are mechanically distinguishable. Reachability check must honor a **dev-only `?forceDbDown=1` query param** (ignored when `NODE_ENV === "production"`) so the unreachable state is drivable restart-free. When reachable and no param, behavior is unchanged.

### Part A/B shared (allowed, minimal)
- Optionally instrument `src/app/(app)/api/session/finish/route.ts` to return a `persisted: { vocab, errors, grammar, failed: [...] }` summary (per the backlog "Instrument" line) so the probe and recap can read counts instead of re-querying — **but only if** the existing `.catch(() => null)` wrappers are replaced with per-write outcome capture in a way that does not change the happy-path response shape consumers already rely on. If this is done, it is in scope; if you instead have the probe assert purely via fresh db reads, the finish route may stay as-is. State which you did.

## Out of scope (do NOT touch)
- The level-test work from contract-001 (`levelTest.ts`, `levelAssess.ts`, `api/level-test/assess`, `CallRecap`/`LevelTestRecap`, `InCall.tsx` level-test machinery, `call/page.tsx` fixtures).
- Scene mode (`/scene`) and its quest/agenda logic.
- The voice pipeline internals (`useVoiceChat`, `gemini-live.ts`, `api/gemini/token`, audio/TTS).
- The curriculum subsystem (`bootstrapLearnerCurriculumState`, `getCurriculumOverview`, `getNextCurriculumLesson`, `scripts/curriculum/*`, the `supabase-curriculum.sql` migration). The probe must NOT depend on any curriculum RPC.
- The SM-2 / SRS interval math and existing review endpoints.
- Other dashboard sub-pages (`/vocabulary`, `/grammar`, `/errors`, `/sessions`) beyond what's needed for the unreachable banner on `/dashboard` itself — do not rewrite their queries.
- Landing, demo, onboarding, login.

## Schema / DB dependencies (call out explicitly)
- **No curriculum dependency.** `session/finish`'s persistence path does NOT call `bootstrap_learner_curriculum_state` or `pick_next_curriculum_items`. The probe drives only start/turn/finish, so it does NOT need the unapplied `supabase-curriculum.sql` migration. (Recall: that RPC is currently missing from the live schema cache and `curriculumBootstrap.ok=false` everywhere — this contract must stay clear of it.)
- The probe writes only to tables `session/finish` already writes to (`learners`, `sessions`, `turns`, `vocabulary`, `grammar_inventory`, `error_patterns`, plus optionally `expressions`, `phrasing_suggestions`, `learner_interests`). All exist in the live schema (the orchestrator wrote to them manually today). No migration required.
- `markVocabUnknown` lands a row at `srs_state: "learning"`; the scripted transcript should include at least one unknown word so the probe can optionally assert that state too.
- The health ping must use a table guaranteed to exist (e.g. a `head`/`count` on `learners`). Do not ping a curriculum table.

## Criteria (each mechanically checkable by an evaluator)

- [ ] **C1 — Probe passes on a healthy DB.** With a valid `LLM_API_KEY` and reachable Supabase, `npm run probe:persistence` exits `0` and prints `PROBE PASS`. (Contract-permitted QA-mode LLM call; `harness-test-*` guest learner only.)
- [ ] **C2 — Probe asserts real rows, not just "no error."** The probe's PASS is contingent on actual row counts: sessions = 1 ended (`total_turns > 0`, `ended_at` set, non-empty `summary`), turns ≥ 2, vocabulary ≥ 1, grammar_inventory ≥ 1, error_patterns ≥ 1, all scoped to the probe's learner id. The evaluator can confirm by reading the probe source (the assertions exist and gate the exit code) and by the PASS run printing the per-table counts it observed.
- [ ] **C3 — Probe fails loudly on an unreachable DB.** Invoked with `SUPABASE_SERVICE_ROLE_KEY` set to an invalid value (or `NEXT_PUBLIC_SUPABASE_URL` overridden to a non-resolving host via the `npm run probe:persistence` env override), `npm run probe:persistence` exits **non-zero** and prints `PROBE FAIL: <reason>` naming the unreachability — it does NOT hang indefinitely and does NOT silently exit 0. The evaluator triggers this by running: `NEXT_PUBLIC_SUPABASE_URL=https://invalid.example.invalid npm run probe:persistence` (no dev server restart needed; the probe itself hits the bad URL directly).
- [ ] **C4 — Probe cleans up after itself.** After a passing run, no `harness-test-*` learner created by the probe (and none of its sessions/turns/vocab/grammar/errors rows) remain. Two mechanical checks: (a) the probe self-reports a final line `cleanup: deleted learner <id> + N rows; harness-test-* learners remaining: M` and M must be 0; (b) the evaluator independently confirms via a shell service-role REST call: `curl -s -H "apikey: $SR" -H "Authorization: Bearer $SR" "$URL/rest/v1/learners?name=ilike.harness-test-*&select=id"` returns `[]` (where `$SR`/`$URL` come from `.env`). Cleanup also runs on assertion failure (try/finally).
- [ ] **C5 — Probe is fenced to test data.** Source inspection: every `DELETE` in the probe source carries a `.eq('learner_id', learnerId)` or `.eq('id', learnerId)` filter where `learnerId` is the id captured at creation. Grep for `delete` in `scripts/probe-persistence.mjs` — zero hits without a learner_id equality filter.
- [ ] **C6 — `/api/health` reports UP.** With a reachable DB, `GET /api/health` returns HTTP 200 and a JSON body whose `status` field is exactly the string `"up"`. Response body contains no substring matching `postgres://`, `supabase.co/`, or any 32+ character alphanumeric token. Verified by: `curl -s http://localhost:3000/api/health` → inspect status code and body.
- [ ] **C7 — `/api/health` reports DOWN (restart-free).** Sending `GET /api/health` with header `x-harness-force-db-down: 1` returns HTTP 503 and a JSON body whose `status` field is exactly the string `"down"` and whose `error` field is a non-empty string. Response arrives within 10 seconds. Verified by: `curl -s -w "\n%{http_code}" -H "x-harness-force-db-down: 1" http://localhost:3000/api/health`. The toggle is only honored when `NODE_ENV !== "production"`.
- [ ] **C8 — Dashboard distinguishes unreachable from empty (restart-free).** Navigating (with a guest session) to `/dashboard?forceDbDown=1` renders an element with `data-testid="db-unreachable-banner"` (count = 1), and `data-testid="no-learner-state"` is absent in that render. Navigating to `/dashboard` with no param renders normally: `data-testid="db-unreachable-banner"` is absent. The `?forceDbDown=1` toggle is honored only when `NODE_ENV !== "production"`. Both states observable without restarting the dev server. (Testid anchors make this mechanical rather than a text-similarity judgment.)
- [ ] **C9 — `isSupportedLearner` is not dropping valid writes.** The probe PASS (C1) inherently exercises an English→Japanese learner through the full write path. Additionally: source inspection of `src/lib/supportedLanguage.ts` (or wherever `isSupportedLanguagePair` is defined) confirms it returns `true` for `("English", "Japanese")`. The evaluator runs: `grep -n "isSupportedLanguagePair\|supported" src/lib/supportedLanguage.ts` and reads the condition — if it's a whitelist, "English" and "Japanese" are present; if it's a blocklist, they are absent.
- [ ] **C10 — Layer-1 unit tests for the health formatter.** `npm test` output shows tests in `tests/health/` (or equivalent path): one test for `ok: true` input → `{ status: "up" }` / 200, one for `ok: false` input → `{ status: "down", error: <non-empty> }` / 503, one confirming no Supabase URL or key appears in the formatted output. All three pass.
- [ ] **C11 — Existing tests stay green; gates pass.** `npm test` exits 0 with the original 29 tests still passing (count visible in vitest output). `./node_modules/.bin/tsc --noEmit` exits 0. `npm run build` exits 0. The probe script is NOT part of the vitest run.

## Test requirements
- Add Layer-1 vitest tests for the pure `formatHealthResult` helper under `tests/health/` (follow existing style: `import { describe, expect, it } from "vitest"`, import from `@/lib/health`). Cover up→200, down→503+error, and no-secret-leak.
- Do NOT add the probe to the vitest `include` or to `npm test` — it needs a live DB + a real LLM call and would break the deterministic gate. Keep it strictly under `scripts/` invoked by its own `npm run probe:persistence`.
- No paid/live LLM calls and no live DB in any Layer-1 test — the only live LLM + live DB usage is the probe, run manually.
- The existing 29 tests (`tests/level-assess/*`) must stay green.

## Gates that must pass (from HARNESS.md)
- `./node_modules/.bin/tsc --noEmit`
- `npm test` (vitest — Layer 1, no LLM calls)
- `npm run build`

## Safety (verbatim from HARNESS.md)
- The dev server talks to the REAL Supabase project (shared with prod). QA must only create/use guest or `harness-test-*` learners — never read out, modify, or delete other learners' data.
- Never call paid LLM endpoints from Layer-1 tests; mock `fetch`. QA-mode LLM calls only when a contract explicitly requires them.
- Never POST to the production Vercel deployment.

### Probe-specific safety fence (mandatory)
- The probe MUST create exactly one learner whose `name` begins with `harness-test-`, with language pair English→Japanese, and MUST capture that learner's id at creation time.
- Every write and every delete the probe performs MUST be scoped to that captured learner id. No global deletes, no `delete from <table>` without a `learner_id` equality filter, no name-pattern delete that could match a real learner.
- Cleanup MUST run in a `finally` so it executes even when an assertion throws or the LLM call fails.
- The probe MUST NOT read, modify, or delete any learner it did not create, and MUST NOT touch the production Vercel deployment.

> All prior open questions are settled in **Resolved decisions** above (HTTP transport · `.mjs` runner · restart-free `x-harness-force-db-down` / `?forceDbDown=1` toggle).

---

## Evaluator review

**Verdict: REVISE**

### What is solid

The contract's safety model is well-structured. The probe-specific safety fence is explicit and correct: capture learner id at creation, scope every delete to that id, use try/finally, no name-pattern deletes. C5's source-inspection approach is the right mechanism. The `isSupportedLearner` concern is real and observable given the code I read in `db.ts` (lines 29–33 and 192–205) — the guard runs on the fallback `getLearner` path and would silently drop a learner with the wrong language pair. C2's row-count assertions are concrete and gated on exit code. C10/C11 are clean.

### Issues requiring revision

**1. C3 — injection method is ambiguous and may not be evaluator-executable**

C3 says "e.g. run with `NEXT_PUBLIC_SUPABASE_URL` overridden to a non-resolving host, or service key invalidated." Neither example is a concrete command. More critically, because the Resolved decisions locked probe transport to real HTTP routes against a running dev server, overriding `NEXT_PUBLIC_SUPABASE_URL` via a shell env var prefix only affects the probe process itself, not the running dev server's Supabase client. If the probe uses the service-role key directly for assertions (as the Resolved decisions specify), the correct injection is to set `SUPABASE_SERVICE_ROLE_KEY` to a garbage value (which breaks the probe's own Supabase client for the assertion step) or to override `NEXT_PUBLIC_SUPABASE_URL` in the probe's own env. This needs a single, unambiguous, copy-paste shell command the evaluator can run — not two alternatives joined by "or." The current C3 wording leaves the evaluator guessing.

Fix: state the exact command, e.g. `NEXT_PUBLIC_SUPABASE_URL=https://invalid.example.invalid SUPABASE_SERVICE_ROLE_KEY=invalid npm run probe:persistence`, clarify whether the dev server must remain running or not for this test, and confirm the probe's own Supabase client (not the dev server's) is what hits the bad URL.

**2. C7 — the "restart-based injection" in C7 contradicts the Resolved decisions toggle**

C7 says "dev server started with `NEXT_PUBLIC_SUPABASE_URL` pointed at a non-resolving host, the canonical restart-based injection." But the Resolved decisions section explicitly states the toggle must be **restart-free** (`x-harness-force-db-down: 1`). The two contradict each other, leaving the generator and evaluator with conflicting instructions. The evaluator cannot both restart the dev server and avoid restarting it for the same criterion.

Fix: C7 must consistently name the restart-free mechanism from Resolved decisions (`x-harness-force-db-down: 1` request header). The "restart-based" fallback should be removed from C7's body since the Resolved decisions already settled this.

**3. C8 — "distinct state" check is a judgment call without a concrete anchor**

C8 says the unreachable banner's copy must be "clearly different from the existing 'No learner profile found. Start a conversation first.' empty-account message." But the current `dashboard/page.tsx` (lines 62–69) renders the no-learner empty state as a `<p>` with no `data-testid`. Without a required testid or a quoted required string, the evaluator must judge whether whatever the generator wrote is "clearly different enough" — that is a judgment call, not a mechanical check.

Additionally, C8 relies on the restart-free toggle but does not name which of the two mechanisms from Resolved decisions (header vs. query param) the generator should implement, so the evaluator will not know which URL or header to use.

Fix: (a) Require the unreachable banner to carry `data-testid="db-unreachable-banner"` and the existing empty-state `<p>` to carry `data-testid="no-learner-state"`. The evaluator then checks: in force-down mode, `[data-testid="db-unreachable-banner"]` is visible and `[data-testid="no-learner-state"]` is absent; in healthy mode, the reverse. (b) Specify whether the toggle is `?forceDbDown=1` (query param, navigable in Playwright) or `x-harness-force-db-down: 1` (request header, requires Playwright route interception). For dashboard browser testing, the query param is far simpler to verify — recommend locking to that.

**4. C4 — cleanup verification relies on Supabase SQL editor, which the evaluator may not have open**

C4 says "The evaluator can verify by querying `learners` for `name ilike 'harness-test-%'`" but does not specify the mechanism. "Via the Supabase SQL editor" is out-of-band. The evaluator should be able to verify this with a shell command using the service-role key, consistent with how the rest of the probe works.

Fix: Add a concrete shell-level verification step that uses `@supabase/supabase-js` or `curl` against the Supabase REST API with the service-role key. Alternatively, require the probe itself to print the before/after count of `harness-test-*` rows, making cleanup self-reporting. This is a minor fix — the safety model is already correct, just the verification step is underspecified.

**5. C6 — "no secret/connection-string material" is not fully mechanical**

C6 says the response "does not include any secret/connection-string material" but gives no concrete test. What counts as a secret? A connection string? The Supabase project ref? The anon key?

Fix: Add a concrete grep: `curl -s http://localhost:3000/api/health | grep -vE '"status"|"latencyMs"|"up"'` should return only `{}` or similar, OR specify that the response body must match the schema `{ "status": "up", "latencyMs": <number> }` exactly (no extra fields). The current text in my revised C6 above already partially addresses this with a 32+ char token check — that is good enough if kept.

### Summary of required changes

1. **C3**: Replace "e.g. ... or service key invalidated" with a single concrete shell command. Clarify it targets the probe's own Supabase client (not the dev server) and specify whether the dev server must be running.
2. **C7**: Remove the "restart-based injection" wording; replace with the `x-harness-force-db-down: 1` header mechanism that Resolved decisions already settled.
3. **C8**: (a) Require `data-testid="db-unreachable-banner"` on the unreachable state and `data-testid="no-learner-state"` on the existing empty state so the evaluator can assert presence/absence mechanically. (b) Lock the force-down mechanism to `?forceDbDown=1` query param (simpler for Playwright browser navigation) and specify it in the criterion.
4. **C4**: Add a self-reporting or shell-runnable before/after row count check, removing the dependency on an out-of-band Supabase SQL editor session.

The contract is otherwise well-conceived. Items 1–4 above are minimal targeted fixes; none require scope changes.
