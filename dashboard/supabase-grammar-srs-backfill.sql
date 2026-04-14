-- Backfill SRS state for existing grammar rows based on legacy mastery data.
-- Run AFTER supabase-grammar-srs.sql.

-- High mastery (>=80% with >=5 total uses) → known
UPDATE grammar_inventory
SET srs_state = 'known',
    interval_days = 60,
    next_review_at = NULL,
    review_count = COALESCE(review_count, 0)
WHERE (srs_state IS NULL OR srs_state = 'seen')
  AND mastery_score >= 80
  AND (correct_uses + incorrect_uses) >= 5;

-- Decent mastery (>=50% with >=3 uses) but not yet known → reviewing, due in 3d
UPDATE grammar_inventory
SET srs_state = 'reviewing',
    interval_days = GREATEST(COALESCE(interval_days, 0), 3),
    next_review_at = COALESCE(next_review_at, now() + interval '3 days'),
    review_count = COALESCE(review_count, 0)
WHERE (srs_state IS NULL OR srs_state = 'seen')
  AND mastery_score >= 50
  AND (correct_uses + incorrect_uses) >= 3;

-- Any remaining rows with recorded incorrect uses → learning, due now
UPDATE grammar_inventory
SET srs_state = 'learning',
    interval_days = 0,
    next_review_at = COALESCE(next_review_at, now()),
    review_count = COALESCE(review_count, 0)
WHERE (srs_state IS NULL OR srs_state = 'seen')
  AND incorrect_uses > 0;

-- Mirror for vocabulary: high-confidence words from times_used_correctly → known
UPDATE vocabulary
SET srs_state = 'known',
    interval_days = 60,
    next_review_at = NULL
WHERE (srs_state IS NULL OR srs_state = 'seen')
  AND times_used_correctly >= 5
  AND times_used_correctly::float / NULLIF(times_used, 0) >= 0.8;
