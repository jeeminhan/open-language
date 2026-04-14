-- Add SRS (spaced repetition) state to vocabulary.
-- srs_state: 'seen' (encountered, no judgement), 'learning' (tutor confirmed unknown / needs practice),
--            'reviewing' (partially mastered), 'known' (mastered — hide from active review).
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS srs_state text DEFAULT 'seen';
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS interval_days integer DEFAULT 0;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS next_review_at timestamptz;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS ease_factor real DEFAULT 2.5;

-- Backfill from legacy `language` field which was used as a quasi-state.
-- 'unknown' → 'learning' (actively studying), everything else → 'seen' (neutral, not shown as learning).
UPDATE vocabulary
SET srs_state = 'learning',
    next_review_at = COALESCE(next_review_at, now())
WHERE language = 'unknown' AND (srs_state IS NULL OR srs_state = 'seen');

CREATE INDEX IF NOT EXISTS vocabulary_srs_idx
  ON vocabulary(learner_id, srs_state, next_review_at);
