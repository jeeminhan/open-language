# Curriculum Integration Plan

**For:** engineering, product
**Companion to:** `CURRICULUM_SOURCES.md` (the data inventory)
**Scope:** turning the curriculum data into the product, end to end. JP only for v1.

---

## What "baked in" means

Every learning surface — Home, Call, Recap, Vocab, Grammar, Errors, Dashboard — reads from the same `learner_state` and the same picker-driven lesson set. There is no path through the app where the user encounters a word, grammar point, or roleplay deposit that wasn't picked by the curriculum engine.

The product promise on `LANDING_BRIEF.md` (lessons are principled, frequency-driven, deposited into the scenario, and shown to compound) is only deliverable when this is true end to end.

## Phases at a glance

| Phase | Output | Effort |
|---|---|---|
| 0 | Data ingested + grammar skeleton authored | 2–4 weeks calendar |
| 1 | `learner_state` schema + level-test bootstrap | a few days |
| 2 | Picker function | a few days |
| 3 | Picker wired into the call (agenda, tutor prompt, scenario deposit) | ~1 week |
| 4 | Curriculum overlay on every surface | rolling |
| 5 | Maintenance (quarterly refresh, mastery feedback) | ongoing |

The single critical-path item is **authoring the grammar skeleton** in Phase 0 — it is the longest-running content task and gates every later phase that touches grammar.

---

## Phase 0 — Data foundation

**Goal:** any internal query like *"give me the next 50 unknown top-frequency words"* or *"all N4 grammar tagged with `verb-form`"* returns clean, snapshot-tagged results.

### Tasks

- [ ] Set up `data/raw/`, `data/processed/`, `data/generated/` per `CURRICULUM_SOURCES.md`
- [ ] Write ingestion scripts for JMdict, KANJIDIC2, JPDB frequency, Tatoeba (one each in `scripts/curriculum/`)
- [ ] Add Supabase tables: `vocab_items`, `kanji_items`, `frequency_ranks`, `example_sentences`, `grammar_items`, `grammar_examples`, `snapshots`
- [ ] Run first ingestion → tag as `snapshot-2026Q2`, set `picker_active_snapshot`
- [ ] Stand up `/about/data` page with attributions
- [ ] **Begin authoring the JLPT grammar skeleton in parallel** — see below

### The grammar skeleton (in parallel — start day one)

~600 entries across N5–N1. Per entry: pattern, romaji, gloss, 2–3 examples, JLPT level, prereq ids, tags, private DOJG ref.

Workflow:
1. LLM-drafted from a structured prompt with 5 Tatoeba candidates per pattern
2. Human edit pass per entry (gloss, examples, tags, prereqs)
3. Commit to `data/generated/grammar_skeleton.json`
4. `reviewed_at` set on commit — picker only surfaces reviewed entries

**Authoring rate guess:** 20–40 entries per focused day with LLM scaffolding. Realistic to land all 600 in 3–6 weeks of part-time work, faster with multiple authors.

**Done means:** `picker_active_snapshot` is set, `/about/data` is live, at least N5 + N4 of the grammar skeleton is reviewed (~250 entries) — enough to power v1 calls for a beginner learner.

---

## Phase 1 — Learner state

**Goal:** every learner has a current snapshot of what the system thinks they know, and that snapshot can be queried in O(1) per item.

### Schema

```sql
learner_known_vocab    (learner_id, vocab_id, status, mastery_score, last_seen,
                        evidence_session_id, snapshot_id)
learner_known_grammar  (learner_id, grammar_id, status, mastery_score, last_seen,
                        evidence_session_id, snapshot_id)

-- status enum
'unknown' | 'introduced' | 'practiced' | 'mastered'
```

`mastery_score` is a float [0..1] for future SRS use. v1 uses status only.

### Bootstrap from level test

Extend `src/app/(app)/api/level-test/assess/route.ts` to emit a **mastery state**, not just a level label.

| Test placement | Bootstrap rule |
|---|---|
| N5 | All N5 grammar `unknown`. JMdict `news1`+`ichi1` top 500 vocab `mastered`. |
| N4 | All N5 grammar `mastered`. All N4 grammar `unknown`. Top 1500 vocab `mastered`. |
| N3 | N5+N4 grammar `mastered`. N3 `unknown`. Top 3000 vocab `mastered`. |
| N2 | … | Top 6000 vocab `mastered`. |
| N1 | … | Top 10000 vocab `mastered`. |

Existing learners get a one-time bootstrap migration: re-run the level test, or run a quick "rate yourself on these 30 sample sentences" pass.

**Done means:** every learner has rows in `learner_known_vocab` and `learner_known_grammar`. The picker has something to read.

---

## Phase 2 — The picker

**Goal:** given a learner and a scenario, return a deterministic, principled "next lesson" payload.

### Signature

```ts
function pickNextItems(
  learner: LearnerState,
  scenario: Scenario,
  budget: { vocab: number; grammar: number } = { vocab: 5, grammar: 1 }
): {
  vocab: VocabItem[];
  grammar: GrammarItem[];
  explanation: string; // for debugging / admin
}
```

### Heuristic v1

For each candidate vocab item:
```
score = w_freq * frequency_score(item)
      + w_scenario * scenario_relevance(item, scenario)
      + w_recency * (-recency_penalty(item, learner))
```
- `frequency_score` — inverse of rank, normalized
- `scenario_relevance` — 1.0 if item's tags overlap the scenario's tags; 0.3 otherwise
- `recency_penalty` — small downweight if the learner saw it in the last 24h

Filter: only items with `status = 'unknown'`. For grammar, only items whose prereqs are all `mastered` or `practiced`.

Sort, take top N per budget, return.

### Scenario tagging

Each canonical scenario carries a tag set the picker can match against — e.g., `["food", "polite", "transactional", "everyday"]`. Vocab and grammar items inherit tags at ingestion time. See the **roleplay scenarios** document for the canonical set and tag schema.

**Done means:** `pickNextItems(learner, scenario)` returns sensible items for a sample of synthetic learners across all four canonical scenarios. Sanity-check: the picker's choices broadly match what a JLPT-level-aware human teacher would pick.

---

## Phase 3 — Wire into the call

This is where the brief becomes the product.

### Touchpoints

| Surface | Change |
|---|---|
| `src/components/AgendaStrip.tsx` | Reads picker output. Each agenda item renders its frequency rank visibly. |
| Tutor system prompt | Receives picked items as the **lesson plan**. Explicit instructions: teach each, then deploy each in the roleplay. |
| Roleplay scene prompt | Receives picked items as **props to deposit** — "the barista uses 〜てしまう in line 3," "the menu now contains アイス少なめ." |
| Post-call writeback | Items the learner used correctly → `mastered`. Items introduced but stumbled on → `practiced`. Items missed entirely → stay `introduced`. |

### The loop closes

```
Home  →  call  →  picker chose 5 vocab + 1 grammar
                   ↓
                 tutor teaches them
                   ↓
                 roleplay deposits them in the scenario
                   ↓
                 writeback updates learner_state
                   ↓
                 next call's picker picks the new next-most-frequent items
```

**Done means:** a learner can complete a call, the recap shows the items they learned with frequency ranks, and the next call's agenda differs accordingly.

---

## Phase 4 — Surface it everywhere

Each existing surface gets a curriculum overlay. Do these in priority order:

| Priority | Surface | Curriculum view |
|---|---|---|
| 1 | **Home** | "Today: 3 new words, 1 grammar point" preview, pulled live from picker. Fulfills the landing-page promise the moment they land. |
| 2 | **Recap (post-call notebook)** | Explicit "added today" with frequency rank. Closes the loop the landing page promised. |
| 3 | **Vocabulary page** | Learner's known vocab visualized against the frequency curve. "You own top-2,400 of ~50,000." |
| 4 | **Grammar page** | JLPT skeleton with mastery overlay (N5→N1 ladders). |
| 5 | **Dashboard** | One number — rank position. Optional "next 50" preview. |
| 6 | **Errors page** | Mistake patterns linked back to grammar items so picker re-surfaces weak ones with extra weight. |
| 7 | **Onboarding** | Level test → seed mastery → first call has real picked content. |

**Done means:** a curious user can navigate any surface and see how it relates to the frequency rank and JLPT ladder.

---

## Phase 5 — Maintenance

### Recurring

- **Quarterly source pulls** — re-run ingestion, tag new snapshot, run quality regression on a sample of synthetic learner picks, promote `picker_active_snapshot` if green.
- **Mastery feedback loop** — if a learner repeatedly says "I already knew that," nudge their mastery state. If they ask "what does X mean?" for an item we marked `mastered`, downgrade it.

### One-time, eventually

- **SRS / Leitner spacing** layered onto the binary mastery model — `mastery_score` becomes meaningful.
- **Mistake-pattern weighting** — grammar items the learner consistently misses get re-surfaced sooner.
- **Content authoring tools** — admin UI for editing grammar entries, adding examples. Replaces the JSON-in-git workflow once author count > 1.
- **Scenario expansion** — add new canonical scenarios beyond the base 4. Each requires a tag-set definition and a small content pass.

---

## Cross-cutting concerns

| Concern | Handling |
|---|---|
| **Existing learners** | One-time bootstrap migration. Re-run level test or do a 30-sentence self-rating pass. |
| **Attribution shipping** | `/about/data` page + a public CC BY-SA data dump for the processed dataset. In-app "via JMdict" / "via Tatoeba" tags wherever raw upstream text shows. |
| **Snapshot pinning** | Picker is reproducible only if source versions are pinned. Every learner-state row carries `snapshot_id`. Promoting a snapshot is an explicit operation, never automatic. |
| **Privacy** | `learner_known_*` is sensitive. Treat like any other PII — RLS in Supabase, no export without auth. |
| **Authoring throughput** | The grammar skeleton is the throughput bottleneck. Plan for either a multi-author push or a sustained 3–6 week solo pass. |
| **Future KR** | Out of scope. When KR ships, this doc + `CURRICULUM_SOURCES.md` get JP→KR variants. The schema is intentionally language-agnostic so the same picker code serves both. |

---

## Pointers

- `CURRICULUM_SOURCES.md` — data inventory and ingestion pipeline
- `LANDING_BRIEF.md` — product promise this plan delivers
- `LEVEL_BIBLE.md` — level taxonomy, bootstrap source for Phase 1
- `CALL_UI_BRIEF.md` — the surface where Phase 3 lands
- `HOME_VIGNETTE_BRIEF.md` — the surface where Phase 4's first overlay lands
- `src/app/(app)/api/level-test/assess/route.ts` — extended in Phase 1
- `src/components/AgendaStrip.tsx` — rewritten in Phase 3
