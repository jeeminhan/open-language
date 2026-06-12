# Generator state — contract-001 (Fix the level test end-to-end)

Mode: BUILD. Round 1. All three gates green.

## Files changed (why)

- `src/lib/levelAssess.ts` — added pure helpers: `CEFR_LEVELS`, `LEVEL_TEST_EXCHANGE_CAP=5`, `shouldEndLevelTest(userTurnCount, cap=5)`, `buildAssessmentResponseSchema()` (Gemini structured-output schema), `toClientPayload(assessment, assessError)` (maps route result → client payload with `assessmentFailed` flag). Kept `parseJsonResponse` + `normalizeAssessment` untouched (defensive fallback per resolved decision).
- `src/app/(app)/api/level-test/assess/route.ts` — switched the Gemini REST call to structured output (`responseMimeType: "application/json"` + `responseSchema` + `thinkingConfig: { thinkingBudget: 0 }`), dropped `maxOutputTokens`; added test-only `x-harness-force-llm-fail: 1` header (honored only when `NODE_ENV !== "production"`) taking the failure path; route now returns `toClientPayload(...)` so the response carries `assessmentFailed` + `debug`. Empty-transcript default placement is NOT flagged as failed.
- `src/lib/prompts/ja/levelTest.ts` — removed the `[[LEVELTEST_DONE]]` END SIGNAL block; close instruction now says the app ends the call automatically after a few exchanges.
- `src/components/InCall.tsx` — removed token constant/regex/`stripLevelTestToken` and the token+phrase-watching auto-end effect; replaced with a deterministic end gated on `shouldEndLevelTest(userTurnCount, LEVEL_TEST_EXCHANGE_CAP)`. Hoisted a single `userTurnCount` that drives both `levelTestState` and the end-cap. One-shot guard (`levelTestEndScheduledRef`) preserved.
- `src/lib/sessionLogger.ts` — updated the `leveltest-auto-end-scheduled` event variant to `trigger: "exchange-cap"` with `userTurnCount`/`cap` (was `"token" | "phrase"` + `content`).
- `src/components/CallRecap.tsx` — `CallSummary.levelTest` gained optional `assessmentFailed`; `LevelTestRecap` renders a distinct degraded message ("Couldn't assess your level — starting you at …") with `data-testid="leveltest-degraded"` when failed, suppressing the success justification/seed words.
- `src/app/call/page.tsx` — consumes `assessmentFailed` from the assess response into the recap; added QA fixture mode (`?fixture=leveltest-success` → B1 success recap; `?fixture=leveltest-failed` → degraded recap) via `FixtureRecap`, which renders `CallRecap` directly with a hardcoded summary — no auth, no live call, no DB writes, no LLM calls.
- `tests/level-assess/shouldEndLevelTest.test.ts` — NEW (4 tests): false for 0–4, true at 5+, default cap is 5, explicit cap respected.
- `tests/level-assess/buildAssessmentResponseSchema.test.ts` — NEW (4 tests): OBJECT type, required fields, level STRING enum, seedWords ARRAY of STRING.
- `tests/level-assess/toClientPayload.test.ts` — NEW (3 tests): assessmentFailed clear on success, set + debug carried on failure, empty-string error treated as failure.

## Gate results

- `./node_modules/.bin/tsc --noEmit` → exit 0 (no output).
- `npm test` → 5 files, **29 passed (29)**. Original 18 (parseJsonResponse 8 + normalizeAssessment 10) green; +11 new.
- `npm run build` → "✓ Compiled successfully", exit 0. (Pre-existing unrelated "inferred workspace root" warning only.)

## Gemini structured-output request shape — how verified

Per AGENTS.md, verified against `node_modules/@google/genai/dist/genai.d.ts`:
- `GenerationConfig` (line 5063) declares `responseMimeType?: string` (5089), `responseSchema?: Schema` (5093), and `thinkingConfig?: ThinkingConfig` (5105) — all nest under `generationConfig` for the `v1beta/models/${model}:generateContent` REST endpoint, matching the existing working calls in `api/session/finish` and `api/learn/drill-grade`.
- `Type` enum (line 11252) confirms REST schema uses uppercase string types: `STRING`, `ARRAY`, `OBJECT`. Schema supports `enum`, `properties`, `required`, `items` (lines 9675–9707). `thinkingBudget?: number` confirmed (line 10361).
- So `buildAssessmentResponseSchema()` emits `{ type: "OBJECT", properties: { level: { type: "STRING", enum: [...] }, justification: { type: "STRING" }, seedWords: { type: "ARRAY", items: { type: "STRING" } } }, required: [...] }` and the route sets `generationConfig: { temperature, responseMimeType, responseSchema, thinkingConfig: { thinkingBudget: 0 } }`.

## Criteria notes for the evaluator

- **C1/C2 (real placement, live LLM):** POST a B1-ish multi-turn transcript to `/api/level-test/assess` with a guest learner and a valid `LLM_API_KEY`. Returns 200 with `assessmentFailed` falsy, valid `level`, non-default `justification`. `parseJsonResponse` remains as a defensive second pass over the (already-clean) structured text.
- **C3 (failure, restart-free):** POST with header `x-harness-force-llm-fail: 1` (guest learner). Returns 200, `assessmentFailed === true`, non-empty `debug`, and a `[level-test/assess]` server-log line. Works only because dev `NODE_ENV !== "production"`.
- **C4/C5 (recap UI):** `/call?fixture=leveltest-failed` shows the degraded message (`data-testid="leveltest-degraded"`, text "Couldn't assess your level — starting you at A2 …"); `/call?fixture=leveltest-success` shows level **B1** in the large slot + success justification and NO degraded message. Fixture mode renders without auth/learner.
- **C6:** `grep -r "LEVELTEST_DONE" src/` → zero matches (verified).
- **C7a:** phrase fallback (`i have a sense of where you are` / `画面をタップ` / `tap end`) gone from `InCall.tsx` (verified); end path calls `shouldEndLevelTest(...)`.
- **C7b/C8:** covered by the three new test files; all mock-free pure helpers, no live LLM in Layer 1.

## Known issues / could-not-satisfy
None. All criteria addressed.

## Run notes
- Dev server start unchanged: `npm run dev` → http://localhost:3000.
- No new env vars. Fixture mode and the failure-injection header are dev/test-only and inert in production.

---

## Round 2 — proxy fixture exemption (pre-QA smoke defect)

Mode: BUILD (fix). All three gates green.

### Defect
`src/proxy.ts` auth-gated `/call` and redirected `/call?fixture=...` → `/login?next=...` (307) before the page rendered, making the C4/C5 fixture URLs unreachable for an unauthenticated evaluator.

### Files changed (why)
- `src/proxy.ts` — added a dev-only QA exemption. New `isDevFixtureRoute(path, searchParams)` returns true only when `NODE_ENV !== "production"`, `path === "/call"`, and `?fixture=` is `leveltest-success` or `leveltest-failed`. Wired into the existing `isPublic` computation via OR, so the unauthenticated redirect is skipped for exactly those two URLs. `/call` without a recognized fixture (and all of `/call` in production) still auth-gates as before.

### Page change needed?
None. `src/app/call/page.tsx` already short-circuits fixture mode at the top of `CallPage` (reads `?fixture=` on mount and returns `<FixtureRecap>` before any auth/DB/learner lookup). The proxy change alone makes both fixture URLs reachable with no live voice and no auth.

### Gate results
- `./node_modules/.bin/tsc --noEmit` → clean (TSC_OK)
- `npm test` → 5 files / 29 tests passed
- `npm run build` → success; `/call` listed as static (○), Proxy (Middleware) compiled

### QA notes
- Evaluator: navigate directly to `/call?fixture=leveltest-success` and `/call?fixture=leveltest-failed` (dev server, NODE_ENV=development). Both render the level-test recap without auth or audio.
- Production safety: exemption is hard-gated on `NODE_ENV === "production"` returning false, so `/call` stays fully auth-gated in prod regardless of query string.

---

# Generator state — contract-002 (Verify persistence E2E + dead-DB fails loudly)

Mode: BUILD. Round 1. All three gates green; probe smoke-run PASS.

## Files changed (why)

- `src/lib/health.ts` — NEW. Pure `formatHealthResult({ok,error?,latencyMs?})` → `{status,body}` (200/`up`, 503/`down`+non-empty `error`, fallback error when none given, never echoes secrets). Import-safe: no Supabase at module load. `pingDatabase()` lazily `import("./supabase")`, runs a `head`/`count` on `learners` with a 5s `AbortSignal.timeout`, and `sanitizeError()` redacts URLs/postgres strings/32+ char tokens.
- `src/app/(app)/api/health/route.ts` — NEW. GET handler; honors `x-harness-force-db-down: 1` only when `NODE_ENV !== "production"` (→ 503/down), else pings DB through `formatHealthResult`. No auth (proxy.ts already whitelists `/api/health`).
- `src/lib/db.ts` — added `checkDbReachable()`: cheap `head`/`count` on `learners` with 5s timeout, returns `{reachable,error?}` WITHOUT `data ?? []` swallowing. No other query touched.
- `src/app/(app)/dashboard/page.tsx` — added `searchParams` (Promise) prop; dev-only `?forceDbDown=1` (ignored in prod) → reachability false. Unreachable → distinct banner `<div data-testid="db-unreachable-banner">`; existing no-learner `<p>` now carries `data-testid="no-learner-state"`. Reachable + no param = unchanged behavior.
- `scripts/probe-persistence.mjs` — NEW (plain ESM). Mints anon session via `@supabase/ssr` createServerClient + in-memory cookie jar (forwards exact `sb-*` cookies the dev server reads), creates ONE `harness-test-persist-<ts>` English→Japanese learner via service role (supplies `id: crypto.randomUUID()` — `learners.id` is not DB-defaulted), drives `/api/session/start` → 3×`/api/session/turn` → `/api/session/finish` (real Gemini review) over HTTP, asserts rows (sessions ended+turns>0+summary ≥1, turns ≥2, vocab ≥1, grammar ≥1, errors ≥1). Cleanup in `finally`, every delete scoped to captured learner id (turns via `.in('session_id', sessionIds)` for that learner's sessions; others `.eq('learner_id', learnerId)`/`.eq('id', learnerId)`). Granular reasons: `auth-failed` / `llm-failed` / `rows-missing:<table>` / `db-unreachable`. Self-reports `cleanup: deleted learner <id> + N rows; harness-test-* learners remaining: M`.
- `package.json` — added `"probe:persistence": "node --env-file=.env --env-file-if-exists=.env.local scripts/probe-persistence.mjs"` (mirrors `gen:demo-audio`). NOT in `npm test`.
- `tests/health/formatHealthResult.test.ts` — NEW (4 tests): up→200, down→503+error, fallback error, no-secret-leak.

## Finish-route instrumentation decision
Did NOT add a `persisted` summary to `session/finish/route.ts`. The probe asserts purely via fresh service-role db reads (Part A/B shared section permits leaving finish as-is). The route's per-write `.catch` wrappers are untouched — no behavior/response-shape change.

## Gate outputs
- `./node_modules/.bin/tsc --noEmit` → exit 0 (clean, no output).
- `npm test` → `Test Files 6 passed (6) / Tests 33 passed (33)` (29 original level-assess + 4 new health). Exit 0. Probe NOT in vitest run.
- `npm run build` → success; `/api/health` (ƒ) and `/dashboard` (ƒ) compiled. Exit 0.

## Probe smoke-run (against running dev server)
PASS. Per-table counts printed:
- sessions (ended, turns>0, summary): 1 (expect ≥1)
- turns: 3 (expect ≥2)
- vocabulary: 8 (expect ≥1)
- grammar_inventory: 6 (expect ≥1)
- error_patterns: 1 (expect ≥1)
Cleanup: `deleted learner 8f9c0766-... + 26 rows; harness-test-* learners remaining: 0`. Independent service-role read confirms `[]` (zero residual harness learners) after both the PASS run and the C3 fail run.

## C3 fail-loud verified
`NEXT_PUBLIC_SUPABASE_URL=https://invalid.example.invalid npm run probe:persistence` → exit 1, `PROBE FAIL: auth-failed — fetch failed`, finished in ~0.23s (no hang), cleanup ran (no learner created). Note: the auth client prints its own `TypeError: fetch failed` stack to stderr above the final `PROBE FAIL:` line — the exit code (non-zero) and the final granular reason are correct; the stack is cosmetic noise, not a hang.

## C9 finding (isSupportedLearner)
VERIFIED CORRECT — no fix needed. `src/lib/supportedLanguage.ts` `isSupportedLanguagePair` is an exact-match whitelist returning `true` only for `("English","Japanese")`. English→Japanese is NOT dropped. The probe PASS exercises this learner through the full write path, confirming behavior end-to-end.

## Health UP/DOWN + dashboard testids (verified manually against dev server)
- C6: `curl /api/health` → `{"status":"up","latencyMs":138}` HTTP 200, no secrets.
- C7: `curl -H "x-harness-force-db-down: 1" /api/health` → `{"status":"down","error":"Forced DB-down (x-harness-force-db-down)"}` HTTP 503.
- C8: with a minted guest session, `/dashboard?forceDbDown=1` → 200 renders `db-unreachable-banner` only; `/dashboard` (no param, no learner) → 200 renders `no-learner-state` only.

## QA notes / focus areas for evaluator
- C8 requires a guest session: proxy.ts (Next 16 renamed middleware → `src/proxy.ts`) redirects unauthenticated `/dashboard` to `/login`. In Playwright, log in as guest first (login page → "Try without an account"), THEN navigate to `/dashboard?forceDbDown=1`. Unauthenticated curl will 307-redirect.
- C7 uses the request HEADER `x-harness-force-db-down: 1` (not a query param). C8 uses the query PARAM `?forceDbDown=1`. Both restart-free, both dev-only.
- The probe makes ONE real (cheap) Gemini finish-review call per run and writes/cleans a single guest learner — contract-permitted. Re-running is safe and idempotent (fresh learner each time, self-cleaning).
- Dev server left running and untouched; start command unchanged (`npm run dev` → :3000).
