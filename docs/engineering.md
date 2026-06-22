# open-language — engineering

The nuts-and-bolts: how to run it, how the data is shaped, and how it's tested.
For the what-and-why, see the [README](../README.md).

## Running it yourself

You need three things: the Next.js dashboard, a Supabase project, and (optionally)
the Python CLI.

### 1. Clone and install

```bash
git clone https://github.com/jeeminhan/open-language.git
cd open-language
npm install
```

### 2. Set up Supabase

Create a free project at [supabase.com](https://supabase.com). Grab your **Project URL**,
**anon key**, and **service role key** from Project Settings → API.

Then run the migrations **in this order** (they're append-only, so order matters):

```text
supabase-migration.sql
supabase-auth-migration.sql
supabase-add-user-id.sql
supabase-add-session-summary.sql
supabase-curriculum.sql
supabase-vocab-srs.sql
supabase-grammar-srs.sql
supabase-grammar-srs-backfill.sql
supabase-interests-facts.sql
supabase-rate-limits.sql
supabase-alongside.sql
```

### 3. Add your keys

Create `.env.local` in the repo root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LLM (OpenAI-compatible — OpenAI, Together, OpenRouter, local Ollama, etc.)
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# Optional: web search for vocab examples
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=

# Optional: comma-separated user IDs with admin access
ADMIN_USER_IDS=
```

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start talking.

### 5. The Python CLI (optional)

A terminal tutor — same brain, voice-capable.

```bash
cd cli
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

It reads the same `LLM_*` keys from `.env.local`. See `cli/` for voice mode,
push-to-talk, and the rest.

## The loop

A session is never isolated. Each one builds on a persistent record of the learner.

```
1. You talk to the tutor    →  web dashboard or Python CLI
2. It logs the turn         →  Supabase: turns, vocabulary, error_patterns
3. The analyzer extracts    →  new vocab, mistakes made, topics raised
4. SRS schedules review     →  vocab_srs / grammar_srs intervals
5. Next session loads you   →  surfaces what's due + what you actually care about
6. Repeat                   →  every conversation makes the next one smarter
```

## Data model

Persistent learner state lives in Supabase. Migrations are the `supabase-*.sql` files
at the repo root. The learner state is the part that matters:

| Group | Tables | What it holds |
|---|---|---|
| **You** | `learners`, `sessions`, `turns` | profile, every session, every utterance |
| **What you know** | `vocabulary`, `learner_known_vocab`, `learner_known_grammar` | words/patterns you've actually demonstrated |
| **What trips you up** | `error_patterns`, `avoidance_patterns` | recurring mistakes, things you dodge |
| **What you're into** | `learner_interests`, `topic_cache`, `expressions`, `phrasing_suggestions` | topics + phrasings surfaced from conversation |
| **When to review** | `vocab_srs`, `grammar_srs` | per-item interval, ease, next-review date |

The SRS layer is what makes the tutor *remember* instead of starting from zero.

There's also a shared curriculum catalog all learners draw from:
`vocab_items` (JLPT-tagged vocabulary), `grammar_items`, `kanji_items`,
`frequency_ranks`, and `example_sentences`.

## Project structure

```
src/
  app/             Next.js routes — dashboard, call UI, onboarding, auth
  lib/
    tutor.ts            Main tutor pipeline
    agendaRouter.ts     Decides what to surface this session
    learnerCache.ts     Loads + caches per-learner state
    sessionLogger.ts    Persists turns / sessions to Supabase
    prompts/            System prompts (shared with the CLI)
    curriculum/         Curriculum loaders
    scenes/             Scene-style practice modules
    gemini-live.ts      Voice / live integration
    rateLimit.ts, promptSafety.ts, bodyLimit.ts

cli/               Python CLI tutor
  main.py             Entry point
  tutor.py            Conversational loop
  analyzer.py         Extracts vocab, errors, topics from turns
  database.py         Local SQLite + Supabase sync
  voice/              Voice-mode runtime
  tests/              Two-layer test suite (see below)

data/
  raw/, processed/, generated/   Curriculum sources & derived assets

scripts/
  curriculum/        Curriculum import + enrichment

supabase-*.sql     Database migrations (run in order)
```

## Testing — the honest version

The tutor's job is to produce good language output, and most of "good" lives downstream
of an LLM call. So there are two test layers that catch very different things, and one
doesn't replace the other.

### Layer 1 — unit tests (fast, free)

Mock the LLM, verify the plumbing: prompt wiring, response parsing, the deterministic
glue. This is the gate — if it's slow or flaky, prompt work grinds to a halt.

```bash
cd cli && .venv/bin/pytest
```

### Layer 2 — evals (slow, calls the real model)

Runs fixed scenarios from `cli/tests/evals/scenarios.yaml` against the actual LLM and
checks the output shape, language, and analysis structure. Each run drops a JSON artifact
under `cli/tests/evals/runs/<timestamp>/<scenario>.json` so you can diff prompt changes.

```bash
cd cli && .venv/bin/pytest -m eval
```

Assertion types currently supported:

| Type | Checks |
|---|---|
| `response_contains_any` | response text contains at least one listed string |
| `response_language` | response contains characters from the given script (e.g. `hiragana_or_katakana`, `hangul`) |
| `analysis_has_key` | analysis JSON is present and contains the given key |
| `analysis_errors_nonempty` | `analysis.errors` is a non-empty list |

Which catches what:

| Question | Answered by |
|---|---|
| Did I break the code? | Layer 1 (`pytest`) |
| Did I break tutor *quality*? | Layer 2 (`pytest -m eval`) |
| Is my prompt change actually better? | Diff the Layer 2 run artifacts |

Layer 1 is the gate. Layer 2 is the radar.

### Iterating on prompts

1. Run the eval once and inspect `cli/tests/evals/runs/<latest>/`.
2. Edit `prompts/system.txt` (root — shared with the dashboard).
3. Re-run, then diff old vs new run directories:
   ```bash
   diff -r cli/tests/evals/runs/<old-ts> cli/tests/evals/runs/<new-ts>
   ```
4. Add scenarios to `scenarios.yaml` as you discover regressions in the wild.

## Conventions

- **Migrations are append-only.** Don't rewrite an old `supabase-*.sql` — add a new one.
- **Prompts are shared** between the dashboard and CLI via `prompts/system.txt`, which is
  why the eval suite covers both surfaces.
- **Learner state is the product.** Anything touching `vocabulary`, `error_patterns`, or
  `*_srs` should get unit + eval coverage.

The successor project, [minshuku](https://github.com/jeeminhan/minshuku), takes this
testing philosophy further — a 0–100 LLM-judged scoring layer, failure attribution
(template vs. generator vs. model), multi-session trend tracking, and a variance-check
workflow that separates real signal from LLM-grader noise.
