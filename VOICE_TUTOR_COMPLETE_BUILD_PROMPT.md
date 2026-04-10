# Voice Tutor — Complete Build Prompt (All Phases)

## Project Overview

Build an AI-powered voice conversation tutor that runs 100% locally. The user speaks in their target language, the AI tutor responds naturally — correcting errors with the instinct of a great human tutor (sometimes correcting, sometimes letting things slide, sometimes modeling correct usage naturally). Behind the scenes, it builds a longitudinal learner profile tracking error patterns, grammar mastery, vocabulary, and fluency over time.

The app supports any L1→L2 combination but is initially designed for:
- Korean speaker → learning English
- English speaker → learning Japanese

Everything runs locally: Whisper for speech-to-text, Ollama for LLM inference, local TTS for speech output, SQLite for data. Zero cloud dependency, zero API costs, total privacy.

---

## Tech Stack

- **Language:** Python 3.11+
- **LLM:** Ollama (local, OpenAI-compatible API)
- **Speech-to-Text:** OpenAI Whisper (local via whisper.cpp or openai-whisper)
- **Text-to-Speech:** Kokoro or MeloTTS (local, lightweight) → upgrade to Fish Speech later
- **Database:** SQLite
- **CLI UI:** Rich (Python terminal formatting)
- **Dashboard:** Next.js + React + Tailwind CSS + Recharts
- **Fine-tuning:** Unsloth + QLoRA (on Google Colab or local GPU)

---

## Project Structure

```
voice-tutor/
├── main.py                  # CLI entry point, conversation loop, mode switching
├── config.py                # Configuration (model, DB path, TTS engine, etc.)
├── database.py              # SQLite setup, all CRUD operations
├── tutor.py                 # LLM interaction, prompt building, response parsing
├── analyzer.py              # Process analysis JSON, update learner profile
├── display.py               # Rich terminal formatting, session summaries
├── commands.py              # Handle /status, /errors, /grammar, /export, etc.
├── export.py                # Export turns as JSONL for fine-tuning
├── voice/
│   ├── stt.py               # Whisper speech-to-text integration
│   ├── tts.py               # Text-to-speech integration
│   ├── vad.py               # Voice activity detection (Silero)
│   └── audio.py             # Microphone capture, audio playback
├── dashboard/               # Next.js app (Phase 3)
│   ├── package.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # Main dashboard
│   │   │   ├── errors/page.tsx    # Error patterns view
│   │   │   ├── grammar/page.tsx   # Grammar mastery heatmap
│   │   │   ├── sessions/page.tsx  # Session history + transcripts
│   │   │   └── fluency/page.tsx   # Fluency trends over time
│   │   ├── components/
│   │   │   ├── GrammarHeatmap.tsx
│   │   │   ├── ErrorTimeline.tsx
│   │   │   ├── BlindSpotDetector.tsx
│   │   │   ├── FluencyChart.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   └── TranscriptViewer.tsx
│   │   └── lib/
│   │       └── db.ts              # Read from same SQLite DB
│   └── tailwind.config.ts
├── training/                # Fine-tuning utilities (Phase 4)
│   ├── prepare_dataset.py   # Convert exported JSONL → training format
│   ├── annotate.py          # CLI tool for annotating conversation quality
│   └── finetune_colab.ipynb # Colab notebook for QLoRA fine-tuning
├── prompts/
│   └── system.txt           # System prompt template
├── requirements.txt
└── README.md
```

---

## Database Schema (SQLite)

Create all tables on first run. This schema supports the entire app across all phases.

```sql
CREATE TABLE IF NOT EXISTS learners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    native_language TEXT NOT NULL,
    target_language TEXT NOT NULL,
    proficiency_level TEXT,
    correction_tolerance TEXT DEFAULT 'moderate',  -- 'low', 'moderate', 'high'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    learner_id TEXT REFERENCES learners(id),
    mode TEXT DEFAULT 'text',          -- 'text' (Phase 1) or 'voice' (Phase 2)
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    total_turns INTEGER DEFAULT 0,
    errors_detected INTEGER DEFAULT 0,
    corrections_given INTEGER DEFAULT 0,
    code_switches INTEGER DEFAULT 0    -- times learner switched to L1
);

CREATE TABLE IF NOT EXISTS turns (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    turn_number INTEGER,
    user_message TEXT NOT NULL,
    tutor_response TEXT NOT NULL,
    user_audio_path TEXT,              -- Phase 2: path to audio recording
    language_detected TEXT,            -- Phase 2: from Whisper
    whisper_confidence REAL,           -- Phase 2: transcription confidence
    analysis_json TEXT,                -- full structured analysis from LLM
    correction_given BOOLEAN DEFAULT FALSE,
    correction_type TEXT,              -- 'explicit', 'recast', 'model_naturally', 'defer'
    correction_reasoning TEXT,         -- why the model made that decision
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS error_patterns (
    id TEXT PRIMARY KEY,
    learner_id TEXT REFERENCES learners(id),
    description TEXT NOT NULL,
    category TEXT NOT NULL,            -- see categories below
    l1_source TEXT,                    -- why this error happens (L1 interference)
    severity TEXT DEFAULT 'medium',
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP,
    occurrence_count INTEGER DEFAULT 1,
    times_corrected INTEGER DEFAULT 0,
    times_deferred INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',      -- 'active', 'improving', 'resolved'
    example_utterances TEXT            -- JSON array of example sentences
);

-- Error categories by target language:
-- English: article, tense, word_order, preposition, subject_drop, plural,
--          subject_verb_agreement, relative_clause, pronoun, countability
-- Japanese: particle, conjugation, tense, word_order, register, counter,
--           te_form, conditional, passive, causative

CREATE TABLE IF NOT EXISTS grammar_inventory (
    id TEXT PRIMARY KEY,
    learner_id TEXT REFERENCES learners(id),
    pattern TEXT NOT NULL,
    level TEXT,                        -- CEFR (A1-C2) or JLPT (N5-N1)
    correct_uses INTEGER DEFAULT 0,
    incorrect_uses INTEGER DEFAULT 0,
    mastery_score REAL DEFAULT 0.0,   -- 0-100
    l1_interference BOOLEAN DEFAULT FALSE,
    first_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    example_sentences TEXT             -- JSON array
);

CREATE TABLE IF NOT EXISTS vocabulary (
    id TEXT PRIMARY KEY,
    learner_id TEXT REFERENCES learners(id),
    word TEXT NOT NULL,
    reading TEXT,                      -- furigana for Japanese
    language TEXT NOT NULL,
    times_used INTEGER DEFAULT 1,
    times_used_correctly INTEGER DEFAULT 1,
    first_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fluency_snapshots (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    learner_id TEXT REFERENCES learners(id),
    avg_utterance_length REAL,        -- words per turn
    hesitation_count INTEGER,         -- Phase 2: from Whisper timestamps
    self_correction_count INTEGER,
    code_switch_count INTEGER,        -- L1 fallbacks
    unique_words_used INTEGER,
    grammar_variety_score REAL,       -- how many different patterns used
    article_accuracy REAL,            -- specific trackers for top issues
    tense_accuracy REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS avoidance_patterns (
    id TEXT PRIMARY KEY,
    learner_id TEXT REFERENCES learners(id),
    description TEXT NOT NULL,         -- "Avoids passive form"
    evidence TEXT,                     -- JSON array of examples
    suggested_practice TEXT,
    first_noticed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- For fine-tuning data annotation (Phase 4)
CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    turn_id TEXT REFERENCES turns(id),
    quality_score INTEGER,            -- 1-5, how good was the tutor's response
    ideal_response TEXT,              -- what the tutor SHOULD have said
    ideal_correction_action TEXT,     -- what the correction decision SHOULD have been
    notes TEXT,                       -- annotator's notes
    annotated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## System Prompt Template

Save this as `prompts/system.txt`. Variables in {braces} are injected at runtime.

```
You are a language tutor having a natural conversation with a learner. You are warm, patient, and encouraging — like a knowledgeable friend, not a strict teacher. You genuinely care about the learner's progress.

LEARNER PROFILE:
- Name: {learner_name}
- Native language (L1): {native_language}
- Learning (L2): {target_language}
- Proficiency: {proficiency_level}
- Correction tolerance: {correction_tolerance}

ACTIVE ERROR PATTERNS (from past conversations):
{active_errors}

RECENT CORRECTIONS (last 3 turns — don't re-correct these immediately):
{recent_corrections}

WEAK GRAMMAR AREAS (mastery < 50%):
{weak_grammar}

AVOIDANCE PATTERNS (things the learner never uses):
{avoidance_patterns}

CONVERSATION GUIDELINES:
- Respond primarily in {target_language} with {native_language} scaffolding when helpful
- Match the learner's register (formal/casual) — don't be more formal than they are
- Ask follow-up questions to keep the conversation flowing naturally
- Respond to the CONTENT of what they say, not just the errors
- Keep responses conversational length (2-4 sentences typically), not lecture-length
- You can occasionally use {native_language} for brief explanations of tricky concepts
- If the learner code-switches to {native_language}, respond naturally and gently guide back to {target_language}

CORRECTION PHILOSOPHY:
1. FIRST OCCURRENCE of a new error → Model the correct form naturally in YOUR reply. Do NOT mention the error.
2. SECOND OCCURRENCE of the same pattern → Recast — use the correct form prominently. Still no explicit correction.
3. THIRD+ OCCURRENCE (established pattern) → Correct explicitly but briefly and warmly. One sentence max. Then move on. Acknowledge L1 interference if relevant ("This is tricky because {native_language} doesn't have [concept]").
4. NEVER correct during emotional/excited speech. Let them express themselves. Note errors silently.
5. When the learner correctly uses something they previously got wrong → Brief positive acknowledgment ("Nice use of [pattern]!").
6. No more than ONE explicit correction per turn. If there are multiple errors, address the most important one and defer the rest.
7. Prioritize errors that impede communication over minor stylistic issues.

RESPONSE FORMAT:
You MUST respond in EXACTLY this format every time. No exceptions.

[RESPONSE]
Your natural conversational reply here. This is what the learner sees/hears.
[/RESPONSE]

[ANALYSIS]
{
  "errors": [
    {
      "type": "category",
      "observed": "what the learner said",
      "expected": "what they should have said",
      "severity": "low/medium/high",
      "l1_source": "why this error likely happened",
      "pattern_description": "short reusable label for this error pattern"
    }
  ],
  "grammar_used_correctly": [
    {
      "pattern": "grammar pattern name",
      "level": "proficiency level",
      "example": "the sentence where it was used correctly"
    }
  ],
  "vocabulary_used": ["word1", "word2"],
  "correction_action": "none/model_naturally/recast/correct_explicitly",
  "correction_reasoning": "why you chose this correction strategy for this turn",
  "fluency_notes": "observations about hesitation, self-correction, code-switching, confidence level",
  "avoidance_notes": "any grammar patterns or structures the learner seems to be avoiding"
}
[/ANALYSIS]
```

---

## Phase 1: Text-Based CLI Tutor

**Goal:** Get the conversation loop, tutor intelligence, and data tracking working. Text input/output only. This is the foundation everything else builds on.

### main.py

Entry point. Handles:
1. First-run setup: create learner profile if none exists
2. Session creation
3. Conversation loop (input → LLM → parse → display → store → repeat)
4. Command handling (/status, /errors, /grammar, /export, /quit, etc.)
5. Graceful shutdown with session summary

### config.py

Environment variables or config file:
- `OLLAMA_MODEL` — default: "gemma4" (fallback to whatever is available)
- `OLLAMA_BASE_URL` — default: "http://localhost:11434/v1"
- `DB_PATH` — default: "./voice_tutor.db"
- `MODE` — default: "text" (Phase 2 adds "voice")
- `TTS_ENGINE` — default: "none" (Phase 2: "kokoro", "melo", "fish")
- `MAX_CONTEXT_TURNS` — default: 10 (conversation history sent to LLM)

### tutor.py

Core LLM interaction:
1. Build the full prompt by injecting learner context into system prompt template
2. Maintain conversation history in memory (last MAX_CONTEXT_TURNS)
3. Call Ollama via OpenAI SDK: `client.chat.completions.create()`
4. Parse response: split on [RESPONSE]/[/RESPONSE] and [ANALYSIS]/[/ANALYSIS] markers
5. Extract JSON from analysis block with error handling (json.loads with try/except)
6. If parsing fails, return raw response and skip analysis — never crash on bad LLM output

### analyzer.py

Process the analysis JSON and update the database:
1. For each error in `errors[]`:
   - Check if a matching pattern exists in error_patterns table (match on category + fuzzy description match)
   - If exists: increment occurrence_count, update last_seen, append to example_utterances
   - If new: insert new error_pattern row
2. For each item in `grammar_used_correctly[]`:
   - Upsert into grammar_inventory: increment correct_uses, update last_used
3. For each error that involves grammar:
   - Upsert into grammar_inventory: increment incorrect_uses
4. Recalculate mastery_score: `correct / (correct + incorrect) * 100` (minimum 3 uses)
5. For vocabulary: upsert each word, increment times_used
6. Update session counters (errors_detected, corrections_given)
7. Check for avoidance patterns: if a grammar pattern at the learner's level has 0 uses across 10+ sessions, flag it

### display.py

Rich terminal formatting:
- Tutor responses: styled with a left border, slightly different color
- Corrections: subtle highlight (not alarming — warm, not red)
- Grammar tips: indented, smaller, preceded by 📝
- Session header: box with model name, learner info, session number
- Session summary: table with stats
- Error list: table with pattern, count, status, severity

### commands.py

In-conversation commands:
- `/status` — Learner profile summary (level, total sessions, hours practiced, top 5 error patterns)
- `/errors` — All active error patterns with occurrence counts, sorted by frequency
- `/grammar` — Grammar inventory sorted by mastery score (lowest first = weakest areas)
- `/vocab` — Vocabulary stats (total unique words, most used, least confident)
- `/history` — Last 5 session summaries
- `/export` — Export all turns as JSONL to `./exports/turns_YYYYMMDD.jsonl`
- `/annotate` — Enter annotation mode for the last turn (rate quality 1-5, write ideal response)
- `/model [name]` — Switch Ollama model mid-session
- `/level [level]` — Update proficiency level
- `/help` — List all commands
- `/quit` or `/exit` — End session with summary

### export.py

Export conversation data for fine-tuning:
```json
{"input": {"user_utterance": "...", "learner_context": {...}}, "output": {"response": "...", "correction_action": "...", "reasoning": "..."}}
```

Also support exporting annotations (turns that have been rated and annotated) as a separate, higher-quality dataset.

---

## Phase 2: Voice Pipeline

**Goal:** Add speech-to-text and text-to-speech so the user can have spoken conversations. The CLI still works as a fallback. User picks mode on startup.

### voice/stt.py — Speech-to-Text

Use Whisper for local transcription.

**Setup:** `pip install openai-whisper` or use whisper.cpp for faster Apple Silicon performance.

**Implementation:**
1. Load Whisper model on startup (configurable size: "base", "small", "medium", "large-v3-turbo")
   - Default to "base" for quick testing, recommend "large-v3-turbo" for production
2. `transcribe(audio_path)` function:
   - Takes a WAV file path
   - Returns: `{"text": str, "language": str, "segments": [...], "confidence": float}`
   - Segments include word-level timestamps (useful for hesitation detection)
3. Language detection: Whisper auto-detects. Tag each transcript with detected language.
4. Hesitation detection: Look for long gaps between segments (>1.5s) — count as hesitation events.

### voice/vad.py — Voice Activity Detection

Use Silero VAD to detect when the user starts/stops speaking.

**Setup:** `pip install silero-vad` (or torch + download model)

**Implementation:**
1. Load Silero VAD model on startup
2. `detect_speech_boundaries(audio_stream)`:
   - Processes audio in chunks
   - Returns speech start/end timestamps
   - Configurable silence threshold (default: 1.5 seconds of silence = end of turn)
3. This replaces the "press Enter" interaction — the user just talks, and VAD detects when they're done.

### voice/tts.py — Text-to-Speech

Start with a lightweight local TTS engine.

**Option A: Kokoro (82M params, fastest)**
- Tiny model, runs on CPU, near-instant
- Less natural but very responsive
- Good for getting started

**Option B: MeloTTS**
- Supports Japanese, Korean, English natively
- Real-time on CPU
- Better quality than Kokoro for CJK languages

**Option C: Fish Speech (upgrade later)**
- Most natural output
- Voice cloning from 10-second sample
- Heavier, needs more compute

**Implementation:**
1. `speak(text, language)` function:
   - Takes text and target language
   - Generates audio file
   - Plays through system audio
2. Support streaming: start playing audio as it generates (don't wait for full generation)
3. Configurable voice: store a tutor voice profile

### voice/audio.py — Audio I/O

**Setup:** `pip install sounddevice soundfile`

**Implementation:**
1. `record_until_silence()`:
   - Start recording from default microphone
   - Use VAD to detect when user stops speaking
   - Save as WAV file (16kHz, mono)
   - Return file path
2. `play_audio(file_path)`:
   - Play audio file through default speakers
3. Push-to-talk mode (simpler, Phase 2a):
   - Hold spacebar to record, release to process
4. Always-listening mode (Phase 2b):
   - VAD continuously monitors, triggers recording on speech detection

### main.py updates for voice mode

On startup, ask: "Text mode or voice mode?" (or set in config)

Voice conversation loop:
```
1. Record audio (push-to-talk or VAD-triggered)
2. Transcribe with Whisper → get transcript + language + confidence
3. Build prompt with learner context (same as Phase 1)
4. Send to Ollama → get response + analysis
5. Parse response
6. Send [RESPONSE] text to TTS → play audio to user
7. Process [ANALYSIS] in background (same as Phase 1)
8. Store turn with audio_path and whisper metadata
9. Loop
```

### Phase 2 requirements.txt additions

```
openai-whisper>=20231117
sounddevice>=0.4.6
soundfile>=0.12.1
# TTS engine (pick one):
# kokoro>=0.1.0
# melotts>=0.1.0
```

---

## Phase 3: Next.js Dashboard

**Goal:** Web-based visualization of the learner profile data. Reads from the same SQLite database. The user opens this after conversations to review progress — it's not the primary interface.

### Design Aesthetic

Dark, moody, atmospheric — inspired by the Kotonoha mockup aesthetic:
- Background: near-black (#0a0a0f)
- Text: warm off-white (#e0ddd5)
- Accents: muted gold (#c4b99a), ember red (#c45e4a), moss green (#6b9a5b), river blue (#5b7e9a)
- Fonts: Inter for UI, Noto Serif JP/KR for language content, JetBrains Mono for data
- Subtle film grain overlay, atmospheric gradients
- Smooth transitions, understated hover effects

### Dashboard Pages

#### 1. Main Dashboard (`/`)
Overview of learner progress:
- **Header:** Learner name, L1→L2, current level estimate, streak (consecutive days with sessions)
- **Stats row:** Total sessions, total hours, total turns, total unique words
- **Quick view cards:**
  - Top 3 active error patterns with occurrence counts
  - Grammar mastery summary (% of patterns at each mastery level)
  - Recent session list (last 5)
- **Fluency trend:** Small sparkline chart showing avg utterance length over time

#### 2. Error Patterns (`/errors`)
Deep dive into what the learner consistently gets wrong:
- **Error list:** Sortable/filterable table of all error patterns
  - Columns: Description, Category, L1 Source, Count, Times Corrected, Status, Severity, First/Last Seen
  - Filter by: status (active/improving/resolved), category, severity
- **Error timeline chart:** Line chart showing each pattern's occurrence over time
  - X-axis: date, Y-axis: occurrence count per session
  - Color-coded by pattern
  - Shows whether patterns are improving, stable, or worsening
- **Error detail modal:** Click a pattern to see all example utterances where it occurred

#### 3. Grammar Mastery (`/grammar`)
Heatmap/grid of grammar patterns:
- **Grid layout:** Organized by proficiency level (rows) and category (columns)
- **Color coding:**
  - Green (mastery > 80%): consistently used correctly
  - Yellow (mastery 40-80%): mixed usage
  - Red (mastery < 40%): persistent errors
  - Gray: never attempted (blind spot)
- **Click for detail:** Shows correct/incorrect counts, example sentences, trend over time
- **Blind spot section:** Grammar patterns at the learner's level that have never been used
  - Cross-reference proficiency level with grammar inventory to find gaps
  - These aren't errors — they're things the learner avoids or hasn't encountered

#### 4. Session History (`/sessions`)
Browse past conversations:
- **Session list:** Date, duration, turns, errors, corrections
- **Session detail view:** Full transcript with inline annotations
  - Errors highlighted (red underline)
  - Corrections marked (green)
  - Tutor's analysis visible on hover/click
  - If voice mode: playback button for audio segments
- **Session comparison:** Compare stats across sessions to see trends

#### 5. Fluency Trends (`/fluency`)
Charts showing progress over time:
- **Utterance length:** Average words per turn over sessions (longer = more confident)
- **Hesitation frequency:** Pauses per turn (lower = more fluent) — Phase 2 data
- **Self-correction rate:** How often the learner catches their own mistakes
- **Code-switching frequency:** How often they fall back to L1
- **Specific accuracy trackers:** Article accuracy, tense accuracy, etc. (configurable)
- **Vocabulary growth:** Cumulative unique words over time

### Dashboard Tech Details

- **Framework:** Next.js 14+ with App Router, TypeScript, Tailwind CSS
- **Charts:** Recharts for all visualizations
- **Database access:** Use `better-sqlite3` to read from the same SQLite file the Python CLI writes to
- **API routes:** Next.js API routes that query SQLite and return JSON
- **Deployment:** Runs locally on the same machine (`npm run dev` on port 3000)
- **No auth needed:** Single-user, local app

### Dashboard API Routes

```
GET /api/learner              → learner profile
GET /api/sessions             → all sessions (paginated)
GET /api/sessions/[id]        → single session with turns
GET /api/errors               → all error patterns
GET /api/errors/[id]          → error detail with examples
GET /api/grammar              → grammar inventory
GET /api/grammar/heatmap      → grammar data formatted for heatmap
GET /api/vocabulary            → vocabulary stats
GET /api/fluency              → fluency snapshots for charts
GET /api/blindspots           → grammar at learner's level with 0 uses
GET /api/stats                → aggregate stats for dashboard overview
```

---

## Phase 4: Fine-Tuning Pipeline

**Goal:** Use the conversation data collected in Phases 1-3 to fine-tune the LLM for better tutor behavior. This happens after 2-3 months of real use, once you have 500+ annotated turns.

### Step 1: Annotate Conversations

Use the `/annotate` CLI command or the `training/annotate.py` script:

For each turn, rate:
1. **Quality score (1-5):**
   - 5: Perfect response — correction timing, tone, everything right
   - 4: Good response, minor issues
   - 3: Acceptable but could be better
   - 2: Poor — wrong correction timing, awkward tone, missed important error
   - 1: Bad — incorrect correction, killed conversation flow, or was patronizing
2. **Ideal response:** What the tutor SHOULD have said (leave blank if score is 4-5)
3. **Ideal correction action:** What the correction decision SHOULD have been
4. **Notes:** Any observations

### Step 2: Prepare Training Data

`training/prepare_dataset.py`:

1. Load all annotated turns from SQLite
2. Filter: only turns with quality_score >= 4 (keep the good examples) OR turns with ideal_response written (learn from mistakes)
3. Format into three datasets:

**Dataset A: Correction Decisions (~300 examples)**
```json
{
  "messages": [
    {"role": "system", "content": "You are a language tutor. Given the learner's utterance and context, decide whether to correct, defer, recast, or model naturally. Respond with your conversational reply and correction reasoning."},
    {"role": "user", "content": "Utterance: '...'\nContext: {...}"},
    {"role": "assistant", "content": "[RESPONSE]...[/RESPONSE]\n[ANALYSIS]...[/ANALYSIS]"}
  ]
}
```

**Dataset B: Error Analysis (~400 examples)**
```json
{
  "messages": [
    {"role": "system", "content": "Analyze the following utterance from a {native_language} speaker learning {target_language}. Identify all errors, their categories, severity, and L1 interference sources. Return structured JSON."},
    {"role": "user", "content": "...learner utterance..."},
    {"role": "assistant", "content": "{...analysis JSON...}"}
  ]
}
```

**Dataset C: Natural Conversation (~200 examples)**
```json
{
  "messages": [
    {"role": "system", "content": "You are a warm, natural language tutor..."},
    {"role": "user", "content": "...learner message..."},
    {"role": "assistant", "content": "...ideal tutor response..."}
  ]
}
```

4. Split: 90% train, 10% validation
5. Save as JSONL files

### Step 3: Fine-Tune on Google Colab

`training/finetune_colab.ipynb`:

```python
# Install Unsloth (2x faster, 60% less memory)
!pip install unsloth

from unsloth import FastLanguageModel
import torch

# Load base model
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/gemma-2-9b-it",  # or whatever base model
    max_seq_length=4096,
    load_in_4bit=True,  # QLoRA
)

# Add LoRA adapters
model = FastLanguageModel.get_peft_model(
    model,
    r=16,              # LoRA rank
    lora_alpha=16,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0,
    bias="none",
)

# Load dataset
from datasets import load_dataset
dataset = load_dataset("json", data_files="training_data.jsonl")

# Train
from trl import SFTTrainer
from transformers import TrainingArguments

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset["train"],
    max_seq_length=4096,
    args=TrainingArguments(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=5,
        max_steps=100,  # adjust based on dataset size
        learning_rate=2e-4,
        output_dir="outputs",
    ),
)
trainer.train()

# Save LoRA adapter
model.save_pretrained("voice-tutor-lora")

# Merge and export to GGUF for Ollama
model.save_pretrained_merged("voice-tutor-merged", tokenizer)
model.save_pretrained_gguf("voice-tutor-gguf", tokenizer, quantization_method="q4_k_m")
```

### Step 4: Load Fine-Tuned Model in Ollama

Create a Modelfile:
```
FROM ./voice-tutor-gguf/unsloth.Q4_K_M.gguf
SYSTEM "You are a language tutor..."
PARAMETER temperature 0.7
PARAMETER num_ctx 4096
```

```bash
ollama create voice-tutor -f Modelfile
ollama run voice-tutor
```

Update `config.py` to use the new model: `OLLAMA_MODEL=voice-tutor`

### Step 5: Evaluate and Iterate

After loading the fine-tuned model:
1. Run 10 test conversations covering different scenarios
2. Compare against the base model on the same inputs
3. Check: Is correction timing better? Does it feel more natural? Does it catch errors it missed before?
4. If yes: ship it, continue collecting data for the next fine-tune
5. If no: review training data quality, adjust, retrain

---

## Phase 5: Polish & Extend

### Multi-Learner Support
- Allow multiple learner profiles in the database
- On startup, select which learner profile to use
- Separate error patterns, grammar inventory, vocabulary per learner
- Dashboard supports switching between learners

### Mobile Companion (Future)
- React Native or PWA that reads from the SQLite database
- View dashboard on phone after conversations
- Eventually: voice conversations on mobile

### Advanced Features
- **Pronunciation analysis:** Compare Whisper transcript anomalies against expected output. Flag words that Whisper consistently misrecognizes (likely pronunciation issues).
- **Topic suggestions:** Based on grammar weak spots, suggest conversation topics that would naturally elicit those patterns. ("Let's talk about your plans this weekend" → practices future tense)
- **Difficulty progression:** Gradually increase the complexity of the tutor's language as the learner improves.
- **Conversation replay:** In the dashboard, replay full conversations with audio + transcript + real-time annotation highlighting.

---

## Configuration Reference

```env
# .env file
OLLAMA_MODEL=gemma4
OLLAMA_BASE_URL=http://localhost:11434/v1
DB_PATH=./voice_tutor.db
MODE=text                    # text | voice
TTS_ENGINE=none              # none | kokoro | melo | fish
STT_MODEL=base               # base | small | medium | large-v3-turbo
VAD_SILENCE_THRESHOLD=1.5    # seconds of silence before processing
MAX_CONTEXT_TURNS=10          # conversation history length
PUSH_TO_TALK=true             # true: hold key to record, false: always listening
DASHBOARD_PORT=3000
```

## Requirements

```
# Core (Phase 1)
openai>=1.0.0
rich>=13.0.0

# Voice (Phase 2)
openai-whisper>=20231117
sounddevice>=0.4.6
soundfile>=0.12.1
# silero-vad
# kokoro or melotts (TTS)

# Training (Phase 4)
# Run in Google Colab, not locally:
# unsloth, transformers, trl, datasets, torch
```

## Getting Started

```bash
# 1. Clone or create the project
mkdir voice-tutor && cd voice-tutor

# 2. Make sure Ollama is running
ollama serve  # in another terminal
ollama pull gemma4  # or qwen3:8b, gemma3:12b, etc.

# 3. Install dependencies
pip install openai rich

# 4. Run
python main.py

# 5. Create your learner profile on first launch
# 6. Start talking!
```

## Example Session (Text Mode)

```
╭──────────────────────────────────────────────────╮
│  🗣  Voice Tutor v0.1                            │
│  Model: gemma4 | Learner: Dad | Korean → English │
│  Session #12 | Type /help for commands            │
╰──────────────────────────────────────────────────╯

You > Yesterday I go to store and buy the milk for my wife

Tutor > Oh nice! What kind of milk did you get — whole milk,
        2%, oat milk? There are so many choices here!

        ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
        📝 Quick tip: since it was yesterday, we'd say
        "I went to the store and bought milk." Past tense
        on both verbs! Korean marks tense once at the end,
        but English needs it on each verb.

You > Oh right. I went to store and bought oat milk. My wife like it

Tutor > Oat milk is great! I've been seeing it everywhere
        lately. Does your wife use it for coffee or for
        drinking?

        ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
        📝 Two small things: "the store" (article) and
        "my wife likes it" (third person -s).

You > She like... likes! She likes to put in coffee

Tutor > Nice self-catch on "likes"! 👏 And yeah, oat milk
        in coffee is so good. Do you like coffee too, or
        are you more of a tea person?

You > /status

  📊 Learner Profile: Dad
  ─────────────────────────────────────────
  Korean → English | Level: B1 | Sessions: 12
  Total practice time: 2.3 hours
  
  Top Error Patterns:
  1. Missing articles (a/the)     │ 14 occurrences │ active
  2. Past tense errors            │ 8 occurrences  │ improving ↗
  3. Subject-verb agreement       │ 5 occurrences  │ active
  4. Missing prepositions         │ 3 occurrences  │ active
  5. Missing "it" subject         │ 2 occurrences  │ new

You > /quit

  ✅ Session Complete
  ─────────────────────────────────────────
  Duration: 6 minutes | Turns: 4
  Errors detected: 5 | Corrections given: 2
  New patterns: subject-verb agreement
  Improving: past tense (self-corrected! 🎉)
  
  Data saved. Use /export to generate fine-tuning data.
```
