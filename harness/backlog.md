# Backlog

Seeded 2026-06-12 from the revival audit. Target: demo-ready for MEXT interview ~2026-06-25.

## 1. Fix the level test end-to-end (P0)
The first-call level test has never worked. Three root causes, fix all:
- **End signal**: the prompt asks the voice model to append a silent text token `[[LEVELTEST_DONE]]` — impossible over Gemini Live (assistant transcript is transcribed audio). Replace with a deterministic client-side end: cap at N exchanges (`InCall.tsx` already counts turns) and drop the token machinery from `levelTest.ts` + `InCall.tsx`.
- **Truncated JSON**: `api/level-test/assess` calls gemini-2.5-flash with plain text output; thinking tokens eat `maxOutputTokens`. Switch to `responseMimeType: "application/json"` + `responseSchema` + `thinkingConfig: { thinkingBudget: 0 }`, then delete the brace-hunting in `parseJsonResponse`.
- **Silent failure**: every failure path degrades to "A2" with the real error hidden in an unrendered `debug` field. Surface assessment failures in `CallRecap` ("couldn't assess — using default") and log them.
- QA criteria: API-level — POST a fixture transcript to `/api/level-test/assess`, get a non-default level with justification; UI — recap shows the level; failure injection (bad API key) shows the degraded-state message instead of a fake placement.

## 2. Verify memory persistence end-to-end (P0)
The "nothing commits to the database" complaint. `session/finish` runs 6 LLM passes then persists vocab/errors/grammar — but every write is wrapped in `.catch(() => null)`, so failures vanish.
- Instrument: collect per-write outcomes in `session/finish` and return a `persisted: {vocab: n, errors: n, grammar: n, failed: [...]}` summary; show counts in the recap.
- Check the `isSupportedLearner` guard in `db.ts` — confirm it isn't silently dropping writes for valid learners.
- QA criteria: drive a session via API with a fixture transcript; assert rows actually appear (vocab/errors/grammar counts > 0) and the dashboard reflects them.

## 3. Demo polish for interview (P1)
- Walk all five HARNESS.md journeys at 375/768/1440; fix anything broken or visually off.
- Landing → demo → guest call path must be flawless; that is the interview demo.

## Out-of-contract findings (from QA)
- **Supabase schema drift (2026-06-12, from contract-001 QA):** the `supabase-curriculum.sql` migration was never applied to the live project — `bootstrap_learner_curriculum_state(p_cefr_level, p_learner_id)` is missing from the schema cache, so `curriculumBootstrap.ok=false` on every assess call. Best-effort/`.catch`, so nothing user-facing breaks, but it means curriculum bootstrap is a no-op. Apply the migration (or drop the call) when item 2 / curriculum is picked up.
- **DB was paused (2026-06-12):** the Supabase project had auto-paused (NXDOMAIN) — the actual root cause of "nothing commits to the database." Restored this session. If it pauses again, the whole app's persistence dies silently (writes are `.catch(() => null)`). Consider a startup health check that surfaces an unreachable DB instead of swallowing it (candidate for item 2).

## Parked (do not pick up without explicit ask)
- Curriculum Phase 0 data ingestion (2–4 week content project; app runs on the Koenji fallback lesson meanwhile).
- Reviving any pruned mode (alongside/drive/listen/interests/etc. — all in git history).
