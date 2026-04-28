# Labeling rubric — prompt testing dataset

This rubric defines **what "correct tutor behavior" means** for each labeled field.
Labels are the human-authored ground truth that `run_eval.py` scores the live
model output against.

Keep this file short and opinionated. When you hit an edge case while labeling,
decide once, write down the rule here, reuse it forever.

## Scope

This dataset tests **the prompt** (`prompts/system.txt`) — does it produce the
tutor behavior we want given a learner profile, prior history, and a new
message. It does NOT test plumbing, DB writes, voice pipeline, UI, or cost.

## Label schema

Every example has a `labels` dict with these fields:

### `correction_action`   (enum)

What correction strategy should the tutor take on this turn?

| Value | When |
|---|---|
| `none` | No learner error on this turn (including English code-switch greetings, meta-questions like "what does X mean?") |
| `model_naturally` | Learner produced something acceptable but imperfect — tutor should model a more natural form without explicit correction |
| `recast` | Learner made a clear error; first or second occurrence — tutor silently reformulates correctly in its reply |
| `correct_explicitly` | Learner made the **same error ≥3 times**, or the error blocks comprehension — tutor names the mistake explicitly |

**Rule of thumb:** count occurrences of the same pattern in `history` + current turn. 1-2 → `recast`. 3+ → `correct_explicitly`.

### `errors_nonempty`   (bool)

Does the analysis block contain at least one entry in `errors`?

- `true` whenever the learner made a target-language error on this turn
- `false` for English code-switches, meta-questions, and ASR whitespace artifacts (per `IGNORE SPACING/WHITESPACE DIFFS` rule in the system prompt)

### `error_categories`   (list of strings)

Categories of error the tutor should have caught. Scored with **substring match**: label `"tense"` passes if the model emits `"verb_tense"` or `"past_tense"`. Keep labels short and broad:

- `tense` — verb tense/conjugation mismatches
- `particle` — wrong or missing particle (を/が/は/に/etc.)
- `word_choice` — wrong word for the context
- `honorifics` — register or honorific mismatch
- `spelling` — typo or wrong kana/hangul

Empty list `[]` when `errors_nonempty` is `false`.

### `should_quiz_back`   (bool)

Should the reply end with a question to keep the conversation going / check comprehension?

- Almost always `true` — the tutor is supposed to drive conversation.
- `false` only for hard stops: session-end summaries, one-word acknowledgments where a follow-up would feel forced.

Currently predicted mechanically as "response text contains `?` or `？`." Good enough until we find false positives.

### `response_language_ok`   (bool)

Does the reply contain target-language script?

- `true` for Japanese replies that contain hiragana or katakana
- `true` for Korean replies that contain hangul
- `false` if the tutor answered entirely in the learner's L1

Predicted mechanically by Unicode range check on the response text.

### `tone`   (enum, label-only for now)

| Value | Meaning |
|---|---|
| `warm` | Encouraging, natural register, matches learner's casualness |
| `neutral` | Acceptable but flat |
| `too_formal` | Unnecessarily polite for the learner's register |
| `too_strict` | Preachy, lecture-y, report-card-like |

Not yet scored — needs an LLM judge. Labeled now so the dataset is ready when
the judge exists.

## Labeling process

1. Read the history + user_message.
2. Decide what a good tutor would do **before** looking at what the model emitted.
3. Set labels.
4. If you pre-fill from a real session's `analysis` block, treat it as a suggestion — confirm or fix each field.
5. Add a `notes` field explaining edge cases. Future-you will thank present-you.

## When to update this file

- New label field added to schema
- New enum value introduced
- Edge case that bit you while labeling
