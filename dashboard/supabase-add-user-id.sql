-- Open Language — Add user_id and per-user RLS policies
-- Run this in the Supabase SQL Editor AFTER the initial migration

-- ── Step 1: Add user_id column to learners ──────────────────────────
ALTER TABLE learners ADD COLUMN IF NOT EXISTS user_id uuid;

-- ── Step 2: Drop old "allow_all" policies ───────────────────────────
DROP POLICY IF EXISTS "allow_all" ON learners;
DROP POLICY IF EXISTS "allow_all" ON sessions;
DROP POLICY IF EXISTS "allow_all" ON turns;
DROP POLICY IF EXISTS "allow_all" ON error_patterns;
DROP POLICY IF EXISTS "allow_all" ON grammar_inventory;
DROP POLICY IF EXISTS "allow_all" ON vocabulary;
DROP POLICY IF EXISTS "allow_all" ON avoidance_patterns;
DROP POLICY IF EXISTS "allow_all" ON learner_interests;
DROP POLICY IF EXISTS "allow_all" ON topic_cache;
DROP POLICY IF EXISTS "allow_all" ON expressions;
DROP POLICY IF EXISTS "allow_all" ON phrasing_suggestions;

-- Also drop the new-style names in case you already ran a partial migration
DROP POLICY IF EXISTS "users_own_learners" ON learners;
DROP POLICY IF EXISTS "users_own_sessions" ON sessions;
DROP POLICY IF EXISTS "users_own_turns" ON turns;
DROP POLICY IF EXISTS "users_own_errors" ON error_patterns;
DROP POLICY IF EXISTS "users_own_grammar" ON grammar_inventory;
DROP POLICY IF EXISTS "users_own_vocab" ON vocabulary;
DROP POLICY IF EXISTS "users_own_avoidance" ON avoidance_patterns;
DROP POLICY IF EXISTS "users_own_interests" ON learner_interests;
DROP POLICY IF EXISTS "users_own_topics" ON topic_cache;
DROP POLICY IF EXISTS "users_own_expressions" ON expressions;
DROP POLICY IF EXISTS "users_own_phrasing" ON phrasing_suggestions;

-- ── Step 3: Per-user RLS policies ───────────────────────────────────

-- learners: direct user_id match
CREATE POLICY "users_own_learners" ON learners
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- All other tables: learner_id must belong to one of the user's learners
CREATE POLICY "users_own_sessions" ON sessions
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_turns" ON turns
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN learners l ON l.id = s.learner_id
      WHERE l.user_id = auth.uid()
    )
  ) WITH CHECK (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN learners l ON l.id = s.learner_id
      WHERE l.user_id = auth.uid()
    )
  );

CREATE POLICY "users_own_errors" ON error_patterns
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_grammar" ON grammar_inventory
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_vocab" ON vocabulary
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_avoidance" ON avoidance_patterns
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_interests" ON learner_interests
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_topics" ON topic_cache
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_expressions" ON expressions
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_phrasing" ON phrasing_suggestions
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

-- ── Step 4: Index on user_id for fast lookups ───────────────────────
CREATE INDEX IF NOT EXISTS idx_learners_user_id ON learners(user_id);
