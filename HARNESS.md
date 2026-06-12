# HARNESS.md — harness manifest for open-language

> Read by the /harness skill and its generator/evaluator agents. Keep every line current — the loop trusts this file.

## App
Japanese language tutor with persistent learner memory (vocab/SRS, error patterns, grammar mastery). Next.js 16 + Supabase + Gemini Live voice. Deployed at open-language-nine.vercel.app.

## Run
- Dev server: `npm run dev` → http://localhost:3000 (if a sibling app holds :3000, use `PORT=3007 npm run dev` and pass `EVAL_BASE_URL`/`BASE_URL` accordingly).
- Env/stubs: `.env` + `.env.local` provide LLM_API_KEY (Gemini) and Supabase keys. Guest mode works without sign-in (login page → "continue as guest").
- **Harness test user:** the probe and eval (`npm run probe:persistence`, `npm run eval:review`) sign in as a persistent admin-created user (`HARNESS_TEST_EMAIL`/`HARNESS_TEST_PASSWORD` in `.env`) instead of anonymous sign-in, to dodge Supabase's low anon rate limit. To (re)create it: `POST {SUPABASE_URL}/auth/v1/admin/users` with the service-role key, body `{"email":...,"password":...,"email_confirm":true}`. They still create/clean their own per-run `harness-test-*` learners under that user.

## Gates (deterministic, must pass before any QA round)
- `./node_modules/.bin/tsc --noEmit`
- `npm test` (vitest — Layer 1, no LLM calls)
- `npm run build`

## Backlog
- `harness/backlog.md` — seeded from the 2026-06-12 audit (this repo's revival plan)

## Evaluate
- Mode: browser (Playwright)
- Journeys (always walk):
  1. Landing `/` → demo `/demo` (audio walkthrough renders, side panel reveals)
  2. Login as guest → onboarding wizard → `/home`
  3. `/dashboard` → `/vocabulary`, `/grammar`, `/errors`, `/sessions` all render live data without errors
  4. `/scene` renders a quest (Japanese learner)
  5. `/call` loads the call UI (mic-driven conversation itself is QA'd at API level: POST `/api/session/start` → `turn` → `finish`, then verify the dashboard reflects the new session)
- Viewports: 375 / 768 / 1440
- **Safety (absolute):**
  - The dev server talks to the REAL Supabase project (shared with prod). QA must only create/use guest or `harness-test-*` learners — never read out, modify, or delete other learners' data.
  - Never call paid LLM endpoints from Layer-1 tests; mock `fetch`. QA-mode LLM calls only when a contract explicitly requires them.
  - Never POST to the production Vercel deployment.

## Models
- generator: inherit
- evaluator: sonnet (default)

## Conventions
- Pure logic lives in `src/lib/` modules so it is unit-testable; route handlers stay thin.
- LLM JSON responses: always request structured output (`responseMimeType: "application/json"` + `responseSchema`, `thinkingConfig: { thinkingBudget: 0 }`) — never parse prose-wrapped JSON by hand.
- No silent failure: a degraded path (fallback level, skipped write) must surface in the UI or response payload, not vanish into `.catch(() => null)`.
- Tests mirror minshuku's layout: `tests/<area>/<unit>.test.ts`, vitest, Layer 1 deterministic / Layer 2 LLM evals kept separate.
