# Hi, this is open-language.

Hey! I'm Jeemin, and I built this because I'm learning Japanese and I got tired of language apps — and AI chatbots — that forget everything the second you close the tab.

Here's the idea: **open-language is a tutor that actually remembers you.** Every word you look up, every mistake you keep making, every topic you're into — it keeps all of it, and the *next* conversation is built on top of it. Not a flashcard deck. Not a chatbot starting from zero every time. A tutor that remembers your 柿 from last Tuesday.

Right now it teaches Japanese (English ↔ Japanese), on the web or in your terminal.

![open-language](docs/assets/hero.png)

## Try it (no signup, nothing to install)

- **[Play it →](https://open-language-nine.vercel.app)** — talk to the tutor, look up a word, then watch the landing page demo show you what it quietly remembered. ([or watch the demo video](docs/assets/demo.mp4))

Your first session needs no sign-in, and it's free to start. Same code runs locally against your own keys if you'd rather self-host.

## So what's actually happening?

Every other AI chatbot starts the conversation over, every single time. open-language takes notes.

Say you're chatting and you ask what 柿 (*kaki*) means. It saves the word — and schedules it for review. A minute later you say `柿は食べました` with the wrong particle; instead of logging that as one of fifty random mistakes, it files it under the *one* pattern you keep tripping on (は where you wanted を). Two days later, when 柿 comes due, the tutor brings it back on purpose — and steers you toward the particle you missed.

| What you do | What it keeps |
|---|---|
| Look up a word | Saved, scheduled with spaced repetition, resurfaced when due |
| Make the same mistake twice | Grouped by root cause, not logged 50 times |
| Mention something you love | Reused later so practice doesn't feel like homework |
| Come back next session | It loads what's due + what you care about before you say a word |

The whole point: a session is never isolated. Each one makes the next one smarter. That feedback loop *is* the product.

## Wanna run it yourself?

Easiest way is with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Clone it, then paste this:

```
Read AGENTS.md and CLAUDE.md. Get open-language running locally on my machine —
a Supabase project with the migrations run in order, my .env.local with the
Supabase + LLM keys, and the Next.js dashboard on localhost. Walk me through it.
```

Or do it by hand:

```bash
git clone https://github.com/jeeminhan/open-language.git
cd open-language && npm install
# set up Supabase + .env.local first — see docs/engineering.md
npm run dev      # → localhost:3000
```

There's a voice-capable Python CLI too (same brain, in your terminal). Full setup —
the Supabase migrations, every env var, the CLI — lives in **[`docs/engineering.md`](docs/engineering.md)**.

## Where it's at

This is the original, full-stack app — web dashboard, Python CLI, persistent learner memory on Supabase — and it's deployed and working. It's the answer to *"what does a tutor with a memory look like as an actual product?"*

The active research since moved to a focused successor:

> **[minshuku](https://github.com/jeeminhan/minshuku)** — a leaner, text-based Japanese practice system where each night is a tiny story stitched from the words you're due to review. It goes deeper on the part I care most about: keeping an LLM-graded learning loop honest.

open-language stays the reference implementation — the SRS schema, error-pattern tracking, and learner-state model here all carry forward into minshuku.

## A bit under the hood

The learner state is the whole thing. Every word, mistake, interest, and review schedule lives in Supabase, and the tutor loads it before each session so it actually knows you. Most of "good tutoring" lives downstream of an LLM call, so there are two test layers: cheap unit tests for the plumbing, and a slower eval suite that runs real scenarios against the model and checks the output — because a prompt tweak can quietly wreck quality without breaking a single line of code.

The real nuts-and-bolts — setup, the data model, the testing setup, project structure — are all in **[`docs/engineering.md`](docs/engineering.md)**.

Built with TypeScript, Next.js, Supabase, Python, and an OpenAI-compatible LLM. MIT licensed — go nuts.
