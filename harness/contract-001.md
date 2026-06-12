# Contract 001 — Fix the level test end-to-end (P0)

Backlog item: **1. Fix the level test end-to-end (P0)** — "The first-call level test has never worked. Three root causes, fix all: End signal (`[[LEVELTEST_DONE]]` token over Gemini Live is impossible — replace with deterministic client-side end capping at N exchanges and drop the token machinery), Truncated JSON (switch `api/level-test/assess` to `responseMimeType: "application/json"` + `responseSchema` + `thinkingConfig: { thinkingBudget: 0 }`, delete the brace-hunting in `parseJsonResponse`), Silent failure (surface assessment failures in `CallRecap` and log them). QA criteria: API-level — POST a fixture transcript, get a non-default level with justification; UI — recap shows the level; failure injection (bad API key) shows the degraded-state message instead of a fake placement."

## Goal
Make the first-call level test work end-to-end: the call ends deterministically after a fixed number of learner exchanges, the assessor returns a real CEFR level + justification via Gemini structured output, and any failure is shown as an honest degraded state in the recap instead of a silent fake "A2".

## Scope (files that may change)
- `src/lib/prompts/ja/levelTest.ts` — remove the `[[LEVELTEST_DONE]]` END SIGNAL block and any instruction to emit the token; keep the conversation flow but rely on the app to end the call.
- `src/components/InCall.tsx` — remove the token constant/regex/`stripLevelTestToken` helper and the token-watching auto-end effect (~lines 36-45, 663-709); replace with a deterministic end after a fixed cap of learner (user-role) exchanges. Reuse the existing user-turn count already computed for `levelTestState`, and gate the end on a new pure helper `shouldEndLevelTest(userTurnCount, cap)` (see `levelAssess.ts`). Keep the existing one-shot guard pattern so end fires at most once.
- `src/lib/levelAssess.ts` — also add `shouldEndLevelTest(userTurnCount: number, cap = 5): boolean` (pure, returns `userTurnCount >= cap`) so the end-cap decision is unit-testable without a live call.
- `src/app/call/page.tsx` — additionally support a **fixture mode** for QA: when the URL has `?fixture=leveltest-success` or `?fixture=leveltest-failed`, bypass the live voice call and render `CallRecap` directly with a hardcoded level-test `CallSummary` (`leveltest-success` → `levelTest: { level: "B1", justification: "...", seedWords: [] }`, `assessmentFailed` false; `leveltest-failed` → `assessmentFailed: true`). This is the evaluator's only way to verify the recap UI without live audio. Fixture mode must be inert in production behaviour terms (no DB writes, no LLM calls) but may stay in the build.
- `src/app/(app)/api/level-test/assess/route.ts` — additionally honor a test-only failure-injection header `x-harness-force-llm-fail: 1` (respected only when `process.env.NODE_ENV !== "production"`): when present, skip the real Gemini call and take the failure path (return `assessmentFailed: true` + `debug`). This is the canonical, restart-free way for the evaluator to verify C3.
- `src/app/(app)/api/level-test/assess/route.ts` — switch the Gemini REST call to structured output (`responseMimeType: "application/json"` + a `responseSchema` describing `{ level, justification, seedWords }`, `thinkingConfig: { thinkingBudget: 0 }`); stop relying on `maxOutputTokens` to bound prose. Surface the failure path: keep `debug`/server log AND return a machine-readable flag (e.g. `assessmentFailed: true`) so the client can distinguish a real placement from a fallback.
- `src/lib/levelAssess.ts` — add/extract a pure helper that builds the `responseSchema` object (and, if the brace-hunting `parseJsonResponse` is no longer needed by the route, mark it deprecated or remove it; if a unit test still exercises it, leave it but it must not be the route's primary parse path). Add a pure helper to map a route result → the client-facing payload shape including the failure flag, so it is unit-testable.
- `src/app/call/page.tsx` — consume the new `assessmentFailed` flag from the assess response so the recap is told this was a degraded placement rather than a real one.
- `src/components/CallRecap.tsx` (`LevelTestRecap`) — render a visibly distinct degraded-state message when the assessment failed (e.g. "Couldn't assess your level — starting at A2") separate from a real placement justification.
- `tests/level-assess/*` — add Layer-1 vitest coverage for the new pure helpers.

## Out of scope (do NOT touch)
- The call/session pipeline: `useVoiceChat`, `gemini-live.ts`, `api/session/start|turn|finish|end`, `api/gemini/token`.
- Memory persistence / DB writes (`db.ts`, vocab/errors/grammar) — that is backlog item 2.
- Dashboard, vocabulary, grammar, errors, sessions pages.
- Scene mode (`/scene`) and the agenda-routing logic for non-first-calls in `InCall.tsx`.
- The recurring-call recap (`CallRecap` non-level-test branch), demo, landing, onboarding.
- Changing the exact CEFR calibration wording beyond what's needed to remove the token.

## Criteria (each mechanically checkable by a browser/API-driving evaluator)

- [ ] **C1 — Real placement via API.** POST a fixture B1-ish transcript (multi-turn `{role,content}` array, learner handling past tense) to `/api/level-test/assess` with a valid `LLM_API_KEY` and a guest/`harness-test-*` learner. Response is HTTP 200, JSON parses cleanly, `level` is one of A1/A2/B1/B2/C1/C2, `justification` is a non-empty string that is NOT the empty-transcript default ("Not enough conversation to place precisely — starting at A2."), and `assessmentFailed` is falsy. (This is a contract-permitted QA-mode LLM call; use a guest learner only.)

- [ ] **C2 — Structured output, no truncation.** Mechanical/structural checks on `src/app/(app)/api/level-test/assess/route.ts`: `grep` finds `responseMimeType` paired with `"application/json"`, finds `responseSchema`, and finds `thinkingBudget` set to `0`. Behavioral completeness is covered by C1 (a parseable, usable response); additionally, C1's returned `justification` is ≥ 10 characters and does not end mid-token (last char is sentence-terminal punctuation or a letter/kana, not a trailing comma/quote-less fragment).

- [ ] **C3 — Failure surfaces, no fake placement.** Canonical injection (restart-free): POST the C1 fixture to `/api/level-test/assess` with header `x-harness-force-llm-fail: 1` and a guest learner. Response is HTTP 200 with `assessmentFailed === true` and `debug` containing a non-empty error string; the server log shows a `[level-test/assess]` error line. The response must not present this as a confident placement (it carries the failure flag, not a normal justification dressed as success).

- [ ] **C4 — Degraded message in recap UI.** Navigate to `/call?fixture=leveltest-failed`: the level-test recap (`LevelTestRecap`) renders a distinct degraded message (contains "Couldn't assess" or equivalent "starting at A2" wording). Navigate to `/call?fixture=leveltest-success`: that same degraded message is **absent**. The two fixture pages make both halves observable without live audio.

- [ ] **C5 — Level renders on the recap.** Navigate to `/call?fixture=leveltest-success`: the level-test recap shows the CEFR level (`B1`) in the large level slot — not `…`, not blank, not a fallback masquerading as success — and shows the success justification. Verified purely via the fixture URL; walking the live first-call flow is NOT an acceptable path (requires live voice the evaluator cannot drive).

- [ ] **C6 — Token fully removed.** `grep -r "LEVELTEST_DONE" src/` returns zero matches. The string `[[LEVELTEST_DONE]]` appears nowhere in `src/` (prompt, component, helpers).

- [ ] **C7 — Deterministic client-side end.** Two checks: (a) **Structural** — `grep` confirms the phrase-fallback auto-end (`"i have a sense of where you are"` / `画面をタップ`) is gone from `InCall.tsx`, and the end path calls `shouldEndLevelTest(...)`. (b) **Behavioral (unit)** — a Layer-1 vitest exercises `shouldEndLevelTest`: returns false for counts 0–4, true at 5 and above (with default cap), and respects an explicit cap argument. This proves the cap actually fires the end decision rather than being left at an unreachable value. End fires at most once (one-shot guard preserved).

- [ ] **C8 — Pure helpers unit-tested.** New Layer-1 vitest tests cover: the `responseSchema` builder (asserts shape: object type, required `level`/`justification`/`seedWords`, level enum); the route-result → client-payload mapper (asserts `assessmentFailed` set on the degraded path, clear on success); and `shouldEndLevelTest` (per C7b). Tests mock any `fetch`; no live LLM calls.

## Test requirements
- Add Layer-1 vitest tests under `tests/level-assess/` for every new pure helper (responseSchema builder, payload mapper). Follow the existing file style (`import { describe, expect, it } from "vitest"`, import from `@/lib/levelAssess`).
- The existing 18 tests (`tests/level-assess/parseJsonResponse.test.ts`, `normalizeAssessment.test.ts`) must stay green. If `parseJsonResponse` is removed from the route, its tests may only be deleted if the function itself is removed; otherwise keep both function and tests passing.
- No paid/live LLM calls in any Layer-1 test — mock `fetch`.

## Gates that must pass (from HARNESS.md)
- `./node_modules/.bin/tsc --noEmit`
- `npm test` (vitest, Layer 1, no LLM calls)
- `npm run build`

## Safety (verbatim from HARNESS.md)
- The dev server talks to the REAL Supabase project (shared with prod). QA must only create/use guest or `harness-test-*` learners — never read out, modify, or delete other learners' data.
- Never call paid LLM endpoints from Layer-1 tests; mock `fetch`. QA-mode LLM calls only when a contract explicitly requires them. (C1/C2 are the explicitly-permitted QA-mode LLM calls for this contract — guest learner only.)
- Never POST to the production Vercel deployment.

## Resolved decisions (orchestrator, 2026-06-12)
- **Exchange cap N = 5.** Reuse the existing `levelTestState` user-turn counter (already caps at 5). The level test ends deterministically after the learner's 5th exchange. No new counter.
- **Failure flag = `assessmentFailed: true`** on the assess response (as drafted). Client branches on this; `debug` keeps the human-readable error.
- **`parseJsonResponse` kept as a defensive fallback.** The route uses structured output as the primary path but may defensively run the parsed text through `parseJsonResponse`; the function and its 8 existing tests (incl. the truncated-JSON regression fixture) stay. Do NOT delete it.

## Implementation note (per AGENTS.md)
AGENTS.md warns this Next/Gemini setup may differ from training data. Before writing the structured-output request, verify the exact REST shape — specifically whether `responseSchema`, `responseMimeType`, and `thinkingConfig` nest under `generationConfig` for the `v1beta/models/${model}:generateContent` endpoint — against `node_modules` docs or `@google/genai`, and against the existing working REST calls in `api/session/finish/route.ts` and `api/learn/drill-grade/route.ts` (both use the raw REST endpoint with `generationConfig`). No structured-output call exists in the repo yet; this contract introduces the pattern.
