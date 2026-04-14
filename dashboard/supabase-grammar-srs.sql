-- Grammar SRS columns (mirrors vocabulary SRS)
ALTER TABLE grammar_inventory ADD COLUMN IF NOT EXISTS srs_state text DEFAULT 'seen';
ALTER TABLE grammar_inventory ADD COLUMN IF NOT EXISTS interval_days integer DEFAULT 0;
ALTER TABLE grammar_inventory ADD COLUMN IF NOT EXISTS next_review_at timestamptz;
ALTER TABLE grammar_inventory ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;

-- Seed: patterns with any incorrect use and mastery < 70 → learning, due now
UPDATE grammar_inventory
SET srs_state = 'learning', next_review_at = COALESCE(next_review_at, now())
WHERE (srs_state IS NULL OR srs_state = 'seen')
  AND incorrect_uses > 0
  AND mastery_score < 70;

CREATE INDEX IF NOT EXISTS grammar_srs_idx
  ON grammar_inventory(learner_id, srs_state, next_review_at);
