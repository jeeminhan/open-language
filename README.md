# Hi, this is open-language.

![open-language](docs/assets/hero.png)

It's a language tutor that actually remembers you. Every word you look up, every mistake you keep making, every topic you're into — it keeps all of it, across every session. So the next conversation isn't a cold start. Kind of like a real tutor who remembers last week.

Right now it teaches Japanese (English ↔ Japanese), on the web or in your terminal.

**Try it without setting anything up:** [open-language-nine.vercel.app](https://open-language-nine.vercel.app) — free to start, no install. Want to run your own copy? Keep reading.

This is the open-source version. MIT licensed — tinker with it, fork it, build your own features, start a company out of it, I don't mind. Go crazy.

## See it in 60 seconds

A short Japanese conversation between a tutor and a learner. Watch what happens on the side — every word, grammar pattern, and mistake gets quietly saved, and the *next* session uses that memory.

<video src="https://github.com/jeeminhan/open-language/raw/main/docs/assets/demo.mp4" controls width="720"></video>

[▶ Watch it live](https://open-language-nine.vercel.app) · [Download the video](docs/assets/demo.mp4)

## Get started with Claude Code

The fastest way to get this running is with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Once it's running, paste this:

```
Hi Claude.
Clone https://github.com/jeeminhan/open-language.git into my current directory.
Then read AGENTS.md and CLAUDE.md. I want to run open-language locally.
Help me set up everything — a Supabase project with the migrations run in order,
my .env.local with the Supabase + LLM keys, and the Next.js dashboard on localhost.
Walk me through it.
```

That's it. It'll clone the repo, read the docs, and walk you through the whole thing. Then keep talking to it — build features, fix bugs, whatever.

## Manual setup

Prefer to do it yourself? Here's the deal. You need three things: the Next.js dashboard, a Supabase project, and (optionally) the Python CLI.

### 1. Clone and install

```bash
git clone https://github.com/jeeminhan/open-language.git
cd open-language
npm install
```

### 2. Set up Supabase

Create a free project at [supabase.com](https://supabase.com). Grab your **Project URL**, **anon key**, and **service role key** from Project Settings → API.

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

There's also a terminal tutor — same brain, voice-capable.

```bash
cd cli
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

It reads the same `LLM_*` keys from `.env.local`. See `cli/` for voice mode, push-to-talk, and the rest.

## How it works

Nothing magic — the trick is that a session is never isolated. Each one builds on a persistent record of *you*.

```
1. You talk to the tutor    →  web dashboard or Python CLI
2. It logs the turn         →  Supabase: turns, vocabulary, error_patterns
3. The analyzer extracts    →  new vocab, mistakes made, topics raised
4. SRS schedules review     →  vocab_srs / grammar_srs intervals
5. Next session loads you   →  surfaces what's due + what you actually care about
6. Repeat                   →  every conversation makes the next one smarter
```

That feedback loop is the whole product thesis. A few things fall out of it:

- **It remembers vocab.** Every word you look up (柿 / persimmon) is saved, scheduled with spaced repetition, and brought back when it's due.
- **It groups mistakes by root cause.** Keep mixing up は vs が? That's *one* tracked pattern, not 50 scattered log lines.
- **It talks about stuff you like.** Topics you raise get reused so practice doesn't feel like homework.
- **It quizzes you** on the words you're about to forget.

## Under the hood

**Stack:** Next.js (App Router) dashboard, a Python CLI, Supabase (Postgres + auth + RLS) for state, an OpenAI-compatible LLM, and pytest for a two-layer test suite.

The persistent learner state is the part that matters. Roughly:

| Group | Tables | What it holds |
|---|---|---|
| **You** | `learners`, `sessions`, `turns` | profile, every session, every utterance |
| **What you know** | `vocabulary`, `learner_known_vocab`, `learner_known_grammar` | words/patterns you've actually demonstrated |
| **What trips you up** | `error_patterns`, `avoidance_patterns` | recurring mistakes, things you dodge |
| **What you're into** | `learner_interests`, `topic_cache`, `expressions` | topics + phrasings surfaced from conversation |
| **When to review** | `vocab_srs`, `grammar_srs` | per-item interval, ease, next-review date |

The SRS layer is what makes it *remember* instead of starting from zero every time. (There's also a shared curriculum catalog — `vocab_items`, `grammar_items`, `kanji_items`, etc. — that all learners draw from.)

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

cli/               Python CLI tutor
  main.py             Entry point
  tutor.py            Conversational loop
  analyzer.py         Extracts vocab, errors, topics from turns
  database.py         Local SQLite + Supabase sync
  voice/              Voice-mode runtime
  tests/              Two-layer test suite (see below)

supabase-*.sql     Database migrations (run in order)
```

## Testing — the honest version

The tutor's job is to produce good language output, and most of "good" lives downstream of an LLM call. So there are two test layers that catch very different things, and one doesn't replace the other.

**Layer 1 — unit tests (fast, free).** Mock the LLM, verify the plumbing: prompt wiring, response parsing, the deterministic glue. This is the gate — if it's slow or flaky, prompt work grinds to a halt.

```bash
cd cli && .venv/bin/pytest
```

**Layer 2 — evals (slow, calls the real model).** Runs fixed scenarios from `cli/tests/evals/scenarios.yaml` against the actual LLM and checks the output shape, language, and analysis. Each run drops a JSON artifact under `cli/tests/evals/runs/<timestamp>/` so you can diff prompt changes.

```bash
cd cli && .venv/bin/pytest -m eval
```

Quick gut-check on which catches what:

| Question | Answered by |
|---|---|
| Did I break the code? | Layer 1 (`pytest`) |
| Did I break tutor *quality*? | Layer 2 (`pytest -m eval`) |
| Is my prompt change actually better? | Diff the Layer 2 run artifacts |

Layer 1 is the gate. Layer 2 is the radar.

## A note on what's next

This repo is the original full-stack app — the answer to *"what does a tutor with a memory look like as a product?"*

The active research has since moved to a focused successor:

> **[minshuku](https://github.com/jeeminhan/minshuku)** — a leaner, text-based Japanese practice system that goes deeper on the part I care most about: keeping an LLM-graded learning loop honest. Scene generation, rule-based evaluation, a 0–100 LLM-judged scoring layer, failure attribution (template vs. generator vs. model), and a variance-check workflow that separates real signal from grader noise.

open-language stays the reference implementation — the SRS schema, error-pattern tracking, and learner-state model here all carry forward into minshuku.

## Contributing

PRs welcome. If you're on Claude Code, it already knows the codebase — point it at `AGENTS.md` / `CLAUDE.md` and tell it what you want to build.

A couple of house rules:
- **Migrations are append-only.** Don't rewrite an old `supabase-*.sql` — add a new one.
- **Prompts are shared** between the dashboard and CLI via `prompts/system.txt`, which is why the eval suite covers both.
- **Learner state is the product.** Anything touching `vocabulary`, `error_patterns`, or `*_srs` should get unit + eval coverage.

MIT licensed. Build something cool with it.
