# Contract 003 — Layer-2 review-quality eval harness (`npm run eval:review`)

Backlog item: **Layer-2 review-quality eval harness.** Contract-002's probe proves rows EXIST after a session. It says nothing about whether the LLM `review` was any *good* — whether it caught the particle error, surfaced the unknown word, or fabricated mistakes in clean Japanese. This contract builds the LLM-quality layer: a runnable harness that drives the REAL `/api/session/start → turn(s) → finish` over HTTP with a self-cleaning `harness-test-*` guest learner, captures the returned `review` object for each of ~6–8 hand-labeled transcripts, scores whether the review caught the planted issues (hybrid: rule-based token matching + an LLM judge), and writes a human-readable report the owner reads to judge review quality.

## Goal
Give the owner a one-command, self-cleaning quality report (`evals/report-latest.md`) that scores how well `session/finish`'s LLM review catches deliberately-planted errors / unknown words / grammar across a labeled transcript set — without changing any app behavior, and exiting 0 even when the catch-rate is low (a low score is information, not a crash).

## Resolved decisions (settled by the user — do NOT re-open)
- **Scoring = HYBRID.**
  - **Rule-based** (precise expectations): an expected error is "caught" if any `review.errors[].observed | .expected | .pattern_description` contains the expected token (substring match, e.g. `良き` or `よく`). An expected unknown word is caught if it appears in `review.unknownWords[].word`, `review.vocabularySeen[]`, or `review.queuedForLearning[]`. An expected grammar point is caught if any `review.grammarPracticed[].pattern` contains it.
  - **LLM judge** (a second Gemini call): runs for expectations marked `fuzzy: true`, OR as a fallback when a rule-based check MISSES. The judge receives the transcript + the single expectation + the `review` object and returns `{ caught: boolean, reason: string }` (one line). Structured output per HARNESS.md conventions (`responseMimeType: "application/json"` + `responseSchema`, `thinkingConfig: { thinkingBudget: 0 }`).
  - **Spurious catches** (review items matching no expectation) are reported as a SOFT precision signal only — never a hard failure. The LLM may legitimately catch extra real issues.
- **Dataset = ~6–8 hand-authored labeled transcripts** in `evals/transcripts/*.json`, authored by the generator (see the planned spread below). Per-file shape:
  ```json
  {
    "name": "particle-wa-ga",
    "description": "Learner swaps は/が as subject marker.",
    "messages": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }],
    "expect": {
      "errors": [{ "token": "が", "fuzzy": false }],
      "unknownWords": ["散歩"],
      "grammar": ["て-form"],
      "noErrors": false
    }
  }
  ```
  `expect.errors[]` items are `{ token, fuzzy? }`; `unknownWords` and `grammar` are `string[]`; `noErrors?: boolean` marks the negative/guard case.
- **BASE_URL is configurable** via env (default `http://localhost:3000`). The dev server is frequently on a non-default port — right now :3000 is held by another app (minshuku) and open-language's dev server is on **:3007**. The runner MUST read `EVAL_BASE_URL` (default `http://localhost:3000`) so the evaluator can point it at the live port, e.g. `EVAL_BASE_URL=http://localhost:3007 npm run eval:review`.

## Scope (exact new files)
- **`scripts/eval-review.mjs`** (new — plain ESM, mirroring `scripts/probe-persistence.mjs`): the runner. For EACH transcript it:
  1. Mints an anonymous Supabase session (`signInAnonymously` via `@supabase/ssr`, same cookie-jar pattern as the probe) and creates exactly ONE `harness-test-*` learner (English→Japanese — required by `isSupportedLearner`), capturing its id. **One learner per transcript is acceptable** (each cleaned in its own try/finally), OR a single shared learner reused across transcripts and cleaned at the end — generator's choice, but cleanup must be unconditional and fenced (see Safety).
  2. Drives `POST /api/session/start` → `POST /api/session/turn` (one per user/assistant pair) → `POST /api/session/finish` with the transcript's `messages`, and captures the returned `review` object (the contract-permitted QA-mode Gemini call — guest only).
  3. Scores the `review` against `expect` using the hybrid scorer (rule-based first, LLM judge for `fuzzy` or rule-miss). Records caught/missed per expectation, plus spurious catches (soft).
  4. Cleans up its learner + all scoped rows in a `finally` (reuse the probe's scoped-delete `cleanup(learnerId)` shape).
  - On completion, writes `evals/report-latest.md` (human-readable) with a per-transcript ✓/✗ breakdown and an aggregate catch-rate, and prints a short summary to stdout.
  - Exit semantics: **exit 0** whenever it could run end-to-end (even at 0% catch-rate). **Exit non-zero** ONLY on inability to run: auth failure, DB unreachable, HTTP transport failure, or `session/finish` returning a non-200 / unusable body for ALL transcripts. A low/zero catch-rate on a reachable stack is exit 0.
- **`evals/transcripts/*.json`** (new — ~6–8 files): the hand-authored labeled dataset (planned spread below). Authored by the generator.
- **`evals/report-latest.md`** (generated output; may be gitignored or committed — generator notes which in state file). The directory `evals/` is new.
- **`src/lib/reviewScore.ts`** (new — pure, unit-testable): the rule-based scorer. Exports pure functions, e.g. `scoreErrorExpectation(review, { token })`, `scoreUnknownExpectation(review, word)`, `scoreGrammarExpectation(review, pattern)`, and a `findSpuriousCatches(review, expect)` helper — each returning `{ caught: boolean }` / a list, with NO network and NO LLM. The `.mjs` runner imports the SAME matching logic (either by importing the compiled module, or — since the runner is plain ESM with no `@/` alias — by keeping the pure token-matching helpers tiny and duplicated-but-tested; generator states which, but the unit-tested source of truth lives in `src/lib/reviewScore.ts`).
- **`package.json`** — add `"eval:review": "node --env-file=.env --env-file-if-exists=.env.local scripts/eval-review.mjs"` (exact `gen:demo-audio` / `probe:persistence` env-loading pattern). **NOT added to `npm test`** and NOT part of the deterministic gate.
- **`tests/eval-review/*.test.ts`** (new — Layer-1 vitest, lands in the default gate): unit tests for `src/lib/reviewScore.ts`. Must live under `tests/` but NOT `tests/evals/**` (which vitest excludes). Use `tests/eval-review/`.

## Out of scope (do NOT touch)
- **Do NOT change `src/app/(app)/api/session/finish/route.ts` behavior** — no change to the review prompt, the persistence loop, the response shape, or the normalization. The harness consumes the `review` exactly as it is returned today.
- The level-test / persistence-probe / health / dashboard-banner / nav work from contracts 001 & 002 (`probe-persistence.mjs`, `src/lib/health.ts`, `api/health`, dashboard banners, `levelTest.ts`, etc.). The persistence probe stays as-is; this is a *separate* runner.
- The curriculum subsystem, the SM-2/SRS math, scene mode, the voice pipeline, landing/demo/onboarding/login.
- `src/lib/db.ts` and the session routes generally — the harness drives them over HTTP and reads only the returned `review`; it does NOT add new db helpers (cleanup reuses the probe's scoped-delete approach inline in the `.mjs`).
- The vitest gate config beyond adding the new `tests/eval-review/` directory of Layer-1 tests (which the existing `include: ["tests/**/*.test.ts"]` already picks up).

## Criteria (each mechanically checkable by an evaluator)

- [ ] **C1 — Runner produces the report against the live server.** With the dev server running and a valid `LLM_API_KEY` + reachable Supabase, `EVAL_BASE_URL=http://localhost:<port> npm run eval:review` exits **0** and creates/overwrites `evals/report-latest.md`. The evaluator confirms the file exists and was modified during the run. (BASE_URL configurable per Resolved decisions; the evaluator must use the port the orchestrator's dev server is actually on — currently :3007.)
- [ ] **C2 — Report has a per-transcript ✓/✗ breakdown + an aggregate catch-rate.** `evals/report-latest.md` lists each transcript by `name` with a per-expectation caught/missed marker (a literal `✓` / `✗` or `caught`/`missed`), and a single aggregate catch-rate line (e.g. `Aggregate catch-rate: 11/14 (79%)`). The evaluator greps the report for the aggregate line and confirms one breakdown block per transcript file present in `evals/transcripts/`.
- [ ] **C3 — Every planted-error expectation is evaluated and rendered in the report (harness machinery, not LLM quality).** For each transcript carrying `expect.errors` entries (e.g. `particle-wa-ga.json`, `conjugation-yoki.json`), the report's block for that transcript contains a per-expectation row marked either `✓` or `✗` for each planted error token. The evaluator confirms: (a) every transcript with `expect.errors` has at least one per-expectation row in its block, and (b) the aggregate catch-rate line is present. **The evaluator does NOT require `✓` for any specific expectation** — a 0% catch-rate is a valid PASS for C3 (the harness ran and reported correctly; catch-rate is the signal we read, not a gate). The evaluator records whether clear-cut expectations like `よく`/`が` were actually caught or missed as out-of-contract *informational* notes.
- [ ] **C4 — The LLM-judge path is exercised for `fuzzy` expectations.** At least one transcript carries an expectation marked `fuzzy: true`. The runner writes a judge-invocation line **into `evals/report-latest.md`** (canonical, greppable location — not stdout-only) of the form `judge: <transcript>/<expectation> → caught|missed (<reason>)`, and the judge result determines that expectation's caught/missed. The evaluator confirms with `grep -i "judge:" evals/report-latest.md` returning ≥ 1 line. (Judge may also fire as a fallback on a rule-based miss — generator may surface those too.)
- [ ] **C5 — The negative/guard transcript does NOT report a fabricated "expected-and-missed."** The guard transcript (clean correct Japanese / correct loanword usage, `expect.noErrors: true` with no planted error tokens) must NOT show a planted-error expectation as "expected-and-missed," because it has none. If the review fabricates an error on that transcript, the harness reports it ONLY as a SOFT spurious/precision note, never as a hard expectation failure. The evaluator confirms: the guard transcript's block has no `✗` against any error expectation (it has none to miss), and any fabricated error appears under a "spurious / precision" heading, not a missed-expectation line.
- [ ] **C6 — Run self-cleans (no `harness-test-*` learner remains).** After a run, no learner the harness created remains. Same two-check pattern as contract-002 C4: (a) the runner prints a final cleanup line reporting `harness-test-* learners remaining: 0`; (b) the evaluator independently confirms via the service-role REST call `curl -s -H "apikey: $SR" -H "Authorization: Bearer $SR" "$URL/rest/v1/learners?name=ilike.harness-test-*&select=id"` returns `[]` (where `$SR`/`$URL` come from `.env`). Cleanup runs even when a transcript's `finish` fails (try/finally).
- [ ] **C7 — Layer-1 unit tests for the pure rule-based scorer pass.** `npm test` output shows tests under `tests/eval-review/` covering the token-match scorer: (a) an error token present in `review.errors[].observed|expected|pattern_description` → caught; (b) an absent token → missed; (c) an unknown word present in any of `unknownWords[].word` / `vocabularySeen` / `queuedForLearning` → caught; (d) a grammar pattern present in `grammarPracticed[].pattern` → caught; (e) `findSpuriousCatches` flags a review error matching no expectation. All pass. No network / no LLM in these tests.
- [ ] **C8 — Existing tests stay green; gates pass.** `npm test` exits 0 with the contract-002-era tests still passing (count visible in vitest output), plus the new `tests/eval-review/` tests. `./node_modules/.bin/tsc --noEmit` exits 0. `npm run build` exits 0. `scripts/eval-review.mjs` is NOT in the vitest run.
- [ ] **C9 — `eval:review` is NOT a gate and is a REPORT, not a pass/fail.** `eval:review` is absent from `npm test` / the vitest `include`. Source/behavior inspection confirms the runner exits 0 on a reachable stack regardless of catch-rate (a low score does not crash), and exits non-zero only on inability-to-run (auth/db/transport/all-finish-failed). The evaluator confirms by reading the exit-code logic in `scripts/eval-review.mjs` and observing C1's exit-0 even if some expectations are missed.
- [ ] **C10 — Dataset spans the required spread.** `evals/transcripts/` contains 6–8 `*.json` files covering, at minimum: a particle error (は/が or を), a transitive/intransitive pair, an unknown-word ask, a clean correct-grammar case (expect a grammar credit + NO fabricated errors), a conjugation error (e.g. `良き → よく`), an honorific/keigo misuse, and at least one negative/guard case (e.g. correct loanword usage that must NOT be flagged). Each file matches the `{ name, description, messages, expect }` shape. The evaluator lists the directory and spot-checks two files for valid shape.

## Planned transcript spread (`evals/transcripts/*.json`, 6–8 files)
1. `particle-wa-ga.json` — learner swaps は/が (or を) as a marker → `expect.errors: [{ token: "が" }]` (rule-based).
2. `transitive-intransitive.json` — learner misuses a 自動詞/他動詞 pair (e.g. 開ける/開く or 始める/始まる) → `expect.errors: [{ token: "開けた", fuzzy: true }]` (judge-friendly — pair errors are paraphrase-heavy).
3. `unknown-word-ask.json` — learner asks what a Japanese word means (e.g. "「渋滞」は何ですか？") → `expect.unknownWords: ["渋滞"]`.
4. `clean-correct.json` — fully correct beginner Japanese → `expect: { grammar: ["て-form"], noErrors: true }` (expect a grammar credit AND no fabricated error; fabrication shows up only as soft precision).
5. `conjugation-yoki.json` — learner says `良き` where `よく` is correct → `expect.errors: [{ token: "よく" }]` (clear rule-based; one of C3's clear cases).
6. `keigo-misuse.json` — learner over/under-uses honorifics (e.g. ご覧になられる double-keigo, or plain form to a superior) → `expect.errors: [{ token: "ご覧になる", fuzzy: true }]` (judge — keigo phrasing varies).
7. `loanword-guard.json` (NEGATIVE/GUARD) — learner uses a correct katakana loanword naturally (e.g. コンビニ, アルバイト) → `expect: { noErrors: true }`; the harness must NOT flag the loanword as an error-and-missed; any flag is soft-spurious only.
8. (optional 8th) `te-form-request.json` — learner correctly forms a て-ください request → `expect: { grammar: ["て-form"], noErrors: true }`, reinforcing the clean-grammar-credit signal.

## Test requirements
- Add Layer-1 vitest tests under `tests/eval-review/` for `src/lib/reviewScore.ts` (follow existing style: `import { describe, expect, it } from "vitest"`, import from `@/lib/reviewScore`). Cover the five cases in C7. Build a fixture `review` object inline — no network, no LLM, no live DB.
- Do NOT add `scripts/eval-review.mjs` to the vitest `include` or to `npm test`. It needs a live server + a real LLM call and would break the deterministic gate. Keep it strictly under `scripts/`, invoked only by `npm run eval:review`.
- No paid/live LLM calls and no live DB in any Layer-1 test. The only live LLM + live DB usage is the eval runner, run manually.
- Existing tests (contract-002 era, including `tests/health/*` and `tests/level-assess/*`) must stay green.

## Gates that must pass (from HARNESS.md)
- `./node_modules/.bin/tsc --noEmit`
- `npm test` (vitest — Layer 1, no LLM calls)
- `npm run build`

## Safety (verbatim from HARNESS.md)
- The dev server talks to the REAL Supabase project (shared with prod). QA must only create/use guest or `harness-test-*` learners — never read out, modify, or delete other learners' data.
- Never call paid LLM endpoints from Layer-1 tests; mock `fetch`. QA-mode LLM calls only when a contract explicitly requires them.
- Never POST to the production Vercel deployment.

### Eval-runner safety fence (mandatory — mirrors the contract-002 probe)
- The runner MUST create only learners whose `name` begins with `harness-test-`, language pair English→Japanese, and MUST capture each learner's id at creation time (a single captured id per learner).
- Every write and every delete the runner performs MUST be scoped to a captured learner id. No global deletes, no `delete from <table>` without a `learner_id` (or `id`) equality filter, no name-pattern delete that could match a real learner.
- Cleanup MUST run in a `finally` so it executes even when a `finish` call or the LLM judge throws.
- The runner MUST NOT read, modify, or delete any learner it did not create, and MUST NOT touch the production Vercel deployment.
- **The contract-permitted QA-mode LLM calls are exactly two:** (i) the `session/finish` Gemini review (driven over HTTP as a guest), and (ii) the LLM judge's second Gemini call. Both run for the guest/`harness-test-*` learner only. No other LLM calls; none from Layer-1 tests.

## Resolved decisions (recap — settled, do NOT re-open)
- **Scoring is HYBRID:** rule-based token/substring matching for precise expectations; an LLM judge for `fuzzy: true` expectations and as a fallback on rule-based misses; spurious catches are a SOFT precision signal, never a hard failure.
- **Dataset is ~6–8 hand-authored labeled transcripts** spanning particle / transitive-intransitive / unknown-word-ask / clean-correct / conjugation / keigo / negative-guard, in the `{ name, description, messages, expect }` shape.
- **`EVAL_BASE_URL` is configurable, default `http://localhost:3000`** — the evaluator points it at the live dev port (currently **:3007**, since :3000 is held by minshuku).
- **This is a quality REPORT, not a gate:** `eval:review` exits 0 even at a low catch-rate (the owner reads the report) and exits non-zero only when it cannot run (auth/db/transport/all-finish failure). `eval:review` is never added to `npm test`.

## Open question
- **`fuzzy` rule-miss fallback double-cost.** Running the judge BOTH for every `fuzzy` expectation AND as a fallback for every rule-based miss means a fully-missed run fires one extra Gemini call per missed expectation (~14 expectations across 8 transcripts → up to ~14 judge calls + 8 finish calls per run). That is fine for an occasional manual quality report, but the generator should keep the judge prompt minimal (`thinkingBudget: 0`, single expectation per call) and the report should note total judge-call count so the owner sees the cost. Flagging in case the user wants a cap (e.g. "judge at most N misses per run") — defaulting to no cap unless told otherwise.
