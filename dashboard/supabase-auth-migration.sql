-- Add user_id to learners table to link with Supabase Auth
ALTER TABLE learners ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_learners_user_id ON learners(user_id);

-- Update RLS policies to scope by authenticated user
DROP POLICY IF EXISTS "allow_all" ON learners;
CREATE POLICY "users_own_learners" ON learners
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Cascade: sessions belong to learners owned by the user
DROP POLICY IF EXISTS "allow_all" ON sessions;
CREATE POLICY "users_own_sessions" ON sessions
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

-- Same pattern for all learner-scoped tables
DROP POLICY IF EXISTS "allow_all" ON turns;
CREATE POLICY "users_own_turns" ON turns
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN learners l ON s.learner_id = l.id
      WHERE l.user_id = auth.uid()
    )
  ) WITH CHECK (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN learners l ON s.learner_id = l.id
      WHERE l.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "allow_all" ON error_patterns;
CREATE POLICY "users_own_error_patterns" ON error_patterns
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "allow_all" ON grammar_inventory;
CREATE POLICY "users_own_grammar" ON grammar_inventory
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "allow_all" ON vocabulary;
CREATE POLICY "users_own_vocabulary" ON vocabulary
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "allow_all" ON avoidance_patterns;
CREATE POLICY "users_own_avoidance" ON avoidance_patterns
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "allow_all" ON learner_interests;
CREATE POLICY "users_own_interests" ON learner_interests
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "allow_all" ON topic_cache;
CREATE POLICY "users_own_topics" ON topic_cache
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "allow_all" ON expressions;
CREATE POLICY "users_own_expressions" ON expressions
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "allow_all" ON phrasing_suggestions;
CREATE POLICY "users_own_phrasing" ON phrasing_suggestions
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );
