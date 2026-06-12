# Japanese Curriculum Sources

**For:** engineers ingesting curriculum data, content authors, anyone refreshing a snapshot
**Companion to:** `CURRICULUM_INTEGRATION.md` (the phased rollout that turns this data into the product)
**Scope:** Japanese only for v1. Korean is post-MVP.

---

## Why this exists

The product promise on `LANDING_BRIEF.md` is that lessons are picked principle-first: the next-most-frequent thing the learner doesn't know, anchored in real linguistic data, deposited into the active roleplay scenario. This document is the inventory of where that data comes from, what we owe upstream authors, and how the data flows into our database.

We don't ship vibes. We ship JMdict, KANJIDIC2, JPDB frequency, Tatoeba, and our own JLPT-anchored grammar skeleton. Every other choice on this page falls out of those five.

## Scope & rationale

JP only for v1. Reasons:

- The open-source story for JP is unusually strong — JMdict alone covers ~80% of what we'd otherwise license.
- Yuki (EN→JP) is the primary tutor; Sam (KR→EN) is post-MVP per `HOME_VIGNETTE_BRIEF.md`.
- KR open-source is workable but thinner. Building it later means we copy this doc's structure and not its sources.

What we explicitly chose **not** to use, and why:

| Source | Why we passed |
|---|---|
| **DOJG (Dictionary of Japanese Grammar)** | Copyrighted by Japan Times, no commercial reuse path. We use a JLPT-anchored skeleton we author ourselves. DOJG section numbers may live in private engineering notes for cross-reference; no DOJG text ships. |
| **Tae Kim's Guide to Japanese** | CC BY-NC-SA. The non-commercial clause is a non-starter once we monetize. |
| **Routledge Frequency Dictionary of Japanese** | Copyrighted. We use JPDB instead. |
| **NHK Pitch Accent Dictionary** | Copyrighted. Pitch accent is a known gap for v1 — see *Known gaps* below. |
| **Imabi.org / BunPro / Cure Dolly / TTMIK** | Author rights reserved. Reference only. |

## Source inventory

| Source | Version pinned | License | Role | Where to get |
|---|---|---|---|---|
| **JMdict** | weekly XML, snapshot-tagged per ingestion | CC BY-SA 4.0 | Headwords, readings, glosses, priority tags | [edrdg.org/jmdict](https://www.edrdg.org/jmdict/edict_doc.html) |
| **KANJIDIC2** | weekly XML, snapshot-tagged | CC BY-SA 4.0 | Per-kanji metadata: readings, JLPT level, freq rank, stroke count | [edrdg.org/kanjidic](https://www.edrdg.org/kanjidic/kanjidic2.html) |
| **JPDB frequency list** | most recent published version | freely downloadable, attribution required | Modern frequency rank from a large novel/web corpus | [jpdb.io](https://jpdb.io) (download page) |
| **Tatoeba (JP+EN pairs)** | monthly dump | CC BY 2.0 FR | Example sentences | [tatoeba.org/downloads](https://tatoeba.org/en/downloads) |
| **UniDic** | latest stable (`unidic-cwj` 3.x) | BSD-style (NINJAL) | Morphological analyzer dictionary; fallback frequency | [clrd.ninjal.ac.jp/unidic](https://clrd.ninjal.ac.jp/unidic/) |

## License & attribution obligations

Three concrete things we owe upstream:

1. **An attribution page** at `/about/data` listing each source, license, and link. Public, linked from the site footer.
2. **In-app attribution** wherever raw upstream text shows. JMdict glosses and Tatoeba sentences carry a small "via JMdict" / "via Tatoeba" tag at the surface level.
3. **Share-alike on derived data.** JMdict and KANJIDIC2 are CC BY-SA 4.0 — viral. Our processed dataset (the JSON we actually query) is therefore CC BY-SA 4.0 too. We publish a public data dump compatible with this. Our **authored content** (`grammar_skeleton.json`) is independent — written from non-copyrightable patterns, licensable under CC BY 4.0 since we wrote it.

If we ever decide to ship behind a closed dataset, we have to fork JMdict-derived data out and replace it with re-licensable equivalents. Plan accordingly.

## Local storage layout

```
data/
├── raw/                           # untouched downloads, gitignored, regenerable
│   ├── jmdict-2026-04-29.xml.gz
│   ├── kanjidic2-2026-04-29.xml.gz
│   ├── jpdb-frequency-2026-04.json
│   ├── tatoeba-jpn-eng-2026-04.csv
│   └── unidic-cwj-3.1.0.zip
├── processed/                     # normalized, queryable, committed
│   ├── vocab_items.json
│   ├── kanji_items.json
│   ├── frequency_ranks.json
│   ├── example_sentences.json
│   └── _attribution.json
└── generated/                     # our authored content, committed
    ├── grammar_skeleton.json      # ~600 entries, our text
    └── grammar_examples.json
```

Supabase tables mirror `processed/` and `generated/` after each ingestion run. The raw files are not committed — recoverable from upstream.

## Ingestion pipeline

One script per source under `scripts/curriculum/`. Each script:
1. Reads from `data/raw/<source>-<snapshot>.<ext>`
2. Parses with the source's expected schema
3. Normalizes to our internal shape
4. Writes to `data/processed/<entity>.json`
5. Upserts to Supabase, tagged with the snapshot id

### JMdict

- **Script:** `scripts/curriculum/ingest_jmdict.ts`
- **Parse:** XML → array of entries with `kanji[]`, `kana[]`, `senses[]`, `priority_tags[]`
- **Normalize:** flatten to `vocab_items` rows; deduplicate by `(headword, primary_reading)`; preserve `priority_tags` (`news1`, `ichi1`, `spec1`, `gai1`) for fallback frequency
- **Output:** ~200k rows in `vocab_items.json`
- **Runtime:** ~3 minutes on a laptop
- **Failure modes:** XML schema occasionally adds new entity refs — parser must DTD-resolve, not strip

### KANJIDIC2

- **Script:** `scripts/curriculum/ingest_kanjidic.ts`
- **Parse:** XML → per-character entries
- **Normalize:** `kanji_items` rows; preserve `freq` field (Kanji Newspaper Frequency) and `jlpt` field
- **Output:** ~13k rows
- **Runtime:** seconds

### JPDB frequency

- **Script:** `scripts/curriculum/ingest_jpdb.ts`
- **Parse:** JSON
- **Normalize:** match each entry against `vocab_items` by headword + reading; emit `frequency_ranks` rows with `(vocab_id, rank, source = "jpdb")`. Unmatched entries get logged for manual review.
- **Output:** ~70k matched ranks
- **Runtime:** seconds

### Tatoeba

- **Script:** `scripts/curriculum/ingest_tatoeba.ts`
- **Filter:** JP sentences with EN translation, length 4–25 tokens, quality flag = good or above
- **Tag:** tokenize each JP sentence with UniDic, attach `vocab_ids` it contains, attempt to match `grammar_ids` from skeleton patterns
- **Output:** ~150k example sentences in `example_sentences.json`
- **Runtime:** ~10 minutes

### UniDic

- **Use:** as the morphological analyzer for tokenizing Tatoeba sentences and learner inputs at runtime. Bundled lemma frequency is a fallback if JPDB lacks a word.
- **Not ingested into our schema directly** — runs as a library dependency.

## Internal schema

```sql
-- Source-derived
vocab_items        (id, headword, primary_reading, alt_readings[], senses[], priority_tags[],
                    jlpt_level, source_ids jsonb, snapshot_id)
kanji_items        (id, char, on_readings[], kun_readings[], jlpt_level,
                    freq_rank, stroke_count, snapshot_id)
frequency_ranks    (vocab_id, rank, source, snapshot_id)
example_sentences  (id, jp_text, en_text, vocab_ids[], grammar_ids[],
                    source = "tatoeba", source_id, quality, snapshot_id)

-- Authored
grammar_items      (id, name, romaji, jlpt_level, gloss, prereq_ids[],
                    dojg_ref_private, tags[], reviewed_at, reviewed_by)
grammar_examples   (id, grammar_id, jp_text, en_text,
                    source = "authored" | "tatoeba", source_id?)

-- Joins
vocab_kanji        (vocab_id, kanji_id)

-- Bookkeeping
snapshots          (id, tag, taken_at, sources jsonb, picker_active boolean)
```

Every source-derived row carries a `snapshot_id` so the picker is reproducible — `picker_active_snapshot` decides which snapshot the runtime reads from.

## Authored content — the JLPT grammar skeleton

The single biggest content cost. ~600 grammar patterns, N5→N1, each entry containing:

- Pattern name (e.g., `〜てしまう`)
- Romaji (`-te shimau`)
- One-sentence gloss in our voice
- 2–3 example sentences (preferably Tatoeba, fallback to authored)
- JLPT level
- Prereq grammar item ids
- Tags (`verb-form`, `casual`, `regret`, `formal`, etc.)
- DOJG section reference (private notes only — does not ship)
- `reviewed_at` / `reviewed_by` — picker only surfaces reviewed entries

**Authoring style:** terse, concrete, one analogy per gloss. No academic register. Examples come from situations a real learner would hit — not classroom sentences. Match the late-night-radio voice of `CALL_UI_BRIEF.md`.

**Workflow:**
1. LLM-drafted with a structured prompt against a single grammar point + 5 Tatoeba example candidates
2. Human edit pass — adjust gloss, pick best examples, set tags, mark prereqs
3. Commit to `data/generated/grammar_skeleton.json`
4. `reviewed_at` set on commit; picker reads it

A small admin surface for editing entries comes in Integration Phase 4, not earlier — for v1, JSON in git is fine.

## Quality filters

Excluded at ingestion:

- JMdict entries flagged `arch` (archaic), `obsc` (obscure), or `rare` — excluded from picker eligibility, but still queryable for dictionary lookup
- JMdict entries with no priority tag and no JPDB frequency match — kept, but ranked at the bottom of the unknown-words queue
- Tatoeba sentences below medium quality flag — excluded
- Tatoeba sentences with non-natural register (test sentences, machine-translated) — excluded by source-id blocklist
- KANJIDIC2 entries below stroke-frequency cutoff for non-Joyo kanji — kept but de-prioritized

## Versioning & refresh cadence

- **Quarterly source pulls.** Tag each ingestion run as `snapshot-YYYYQN` (e.g., `snapshot-2026Q3`). The `picker_active_snapshot` setting decides which snapshot the runtime queries.
- **Roll-back.** If a refresh degrades quality (e.g., JMdict deletes a sense we relied on), revert `picker_active_snapshot` to the previous tag. Old snapshot rows stay in the DB.
- **Authored content is independent of snapshots** — `grammar_skeleton.json` versions itself by git history.

## Known gaps & TODOs

- **Pitch accent.** NHK accent dictionary is closed. Open alternatives (Wadoku-derived, Wanikani-derived) are partial. Current plan: ship without pitch accent; revisit when we add a pronunciation surface.
- **Regional / colloquial coverage.** JMdict skews standard Tokyo. Kansai / Tohoku / Kyushu are thin.
- **Onomatopoeia and giongo/gitaigo.** JMdict has them but they're undertagged. Picker may need a category boost.
- **Compound and set phrases.** Not consistently tagged in JMdict. May need a manual pass for the ~200 most common.
- **Tae Kim license** — keep an eye on it; if it ever moves to permissive, our gloss-authoring workload halves.
- **Korean equivalents** — out of scope for v1. When KR ships, we copy this doc's structure and swap sources for kengdic / NIKL frequency / TOPIK skeleton.

## Pointers

- `LANDING_BRIEF.md` — what the user sees on `/`
- `CURRICULUM_INTEGRATION.md` — phased rollout that turns this data into the product
- `LEVEL_BIBLE.md` — level taxonomy that bootstraps learner state
- `CALL_UI_BRIEF.md` / `HOME_VIGNETTE_BRIEF.md` — surfaces where the curriculum gets deposited
- `src/lib/prompts/ja/levelTest.ts` — current level-test prompt; reads from this dataset post-Phase 1
- `src/components/AgendaStrip.tsx` — call agenda; reads picker output post-Phase 3
