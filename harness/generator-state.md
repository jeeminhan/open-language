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
