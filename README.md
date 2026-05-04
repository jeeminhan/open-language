# open-language

A language tutor that actually remembers you — vocab you've looked up, mistakes you keep making, topics you care about — across every session.

> **Try it hosted:** [open-language-nine.vercel.app](https://open-language-nine.vercel.app)
> No setup, free to start. Self-host below if you'd rather run your own.

## Features

- Persistent vocab tracking (e.g. 柿 / persimmon)
- Error grouping by root cause (は vs が, etc.)
- Interest-based personalization
- Spaced-repetition quizzes
- Bilingual EN ↔ JA practice

## Hosted vs self-hosted

This repo is the full app — Python CLI + Next.js dashboard. You can run everything locally with your own API keys (see Setup below).

A hosted version is available at [open-language-nine.vercel.app](https://open-language-nine.vercel.app) for anyone who'd rather skip the setup. It runs the same code as this repo, with managed updates and shared infrastructure. Pricing TBD as the project matures.

## Setup

Self-hosting needs three things: the Next.js dashboard, the Python CLI, and a Supabase project.

### 1. Clone and install

```bash
git clone https://github.com/jeeminhan/open-language.git
cd open-language
npm install
```

### 2. Supabase

Create a free project at [supabase.com](https://supabase.com), then grab your **Project URL**, **anon key**, and **service role key** from Project Settings → API.

### 3. Environment variables

Create `.env.local` in the repo root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LLM (OpenAI-compatible — works with OpenAI, Together, OpenRouter, local Ollama, etc.)
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# Optional: web search for vocab examples
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=

# Optional: comma-separated user IDs with admin access
ADMIN_USER_IDS=
```

### 4. Run the dashboard

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Python CLI (optional)

The CLI gives you voice chat and offline practice from the terminal.

```bash
cd cli
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

The CLI reads the same `LLM_*` variables from `.env.local`. See `cli/` for voice mode, push-to-talk, and other options.
