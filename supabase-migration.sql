-- Open Language — Supabase schema migration
-- Run this in the Supabase SQL Editor (supabase.com/dashboard → SQL Editor)

CREATE TABLE learners (
  id text PRIMARY KEY,
  name text,
  native_language text,
  target_language text,
  proficiency_level text,
  correction_tolerance text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  learner_id text REFERENCES learners(id),
  mode text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  total_turns integer DEFAULT 0,
  errors_detected integer DEFAULT 0,
  corrections_given integer DEFAULT 0,
  code_switches integer DEFAULT 0
);

CREATE TABLE turns (
  id text PRIMARY KEY,
  session_id text REFERENCES sessions(id),
  turn_number integer,
  user_message text,
  tutor_response text,
  analysis_json text,
  correction_given integer DEFAULT 0,
  correction_type text,
  correction_reasoning text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE error_patterns (
  id text PRIMARY KEY,
  learner_id text REFERENCES learners(id),
  description text,
  category text,
  l1_source text,
  severity text,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz,
  occurrence_count integer DEFAULT 1,
  times_corrected integer DEFAULT 0,
  times_deferred integer DEFAULT 0,
  status text DEFAULT 'active',
  example_utterances text
);

CREATE TABLE grammar_inventory (
  id text PRIMARY KEY,
  learner_id text REFERENCES learners(id),
  pattern text,
  level text,
  correct_uses integer DEFAULT 0,
  incorrect_uses integer DEFAULT 0,
  mastery_score double precision DEFAULT 0,
  l1_interference integer DEFAULT 0,
  first_used timestamptz,
  last_used timestamptz,
  example_sentences text
);

CREATE TABLE vocabulary (
  id text PRIMARY KEY,
  learner_id text REFERENCES learners(id),
  word text,
  reading text,
  language text,
  times_used integer DEFAULT 1,
  times_used_correctly integer DEFAULT 0,
  first_used timestamptz DEFAULT now(),
  last_used timestamptz
);

CREATE TABLE avoidance_patterns (
  id text PRIMARY KEY,
  learner_id text REFERENCES learners(id),
  pattern text,
  last_checked timestamptz
);

CREATE TABLE learner_interests (
  id text PRIMARY KEY,
  learner_id text REFERENCES learners(id),
  category text NOT NULL,
  name text NOT NULL,
  details text,
  source text DEFAULT 'detected',
  confidence double precision DEFAULT 0.7,
  first_mentioned timestamptz DEFAULT now(),
  last_mentioned timestamptz,
  mention_count integer DEFAULT 1
);

CREATE TABLE topic_cache (
  id text PRIMARY KEY,
  learner_id text REFERENCES learners(id),
  topic text NOT NULL,
  context text,
  web_snippet text,
  source_url text,
  interest_id text,
  used integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE expressions (
  id text PRIMARY KEY,
  learner_id text REFERENCES learners(id),
  expression text NOT NULL,
  type text NOT NULL,
  meaning text,
  example_context text,
  proficiency text DEFAULT 'passive',
  times_encountered integer DEFAULT 1,
  times_produced integer DEFAULT 0,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz
);

CREATE TABLE phrasing_suggestions (
  id text PRIMARY KEY,
  learner_id text REFERENCES learners(id),
  session_id text,
  original text NOT NULL,
  suggested text NOT NULL,
  grammar_point text,
  explanation text,
  category text DEFAULT 'grammar',
  created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_sessions_learner ON sessions(learner_id);
CREATE INDEX idx_turns_session ON turns(session_id);
CREATE INDEX idx_error_patterns_learner ON error_patterns(learner_id);
CREATE INDEX idx_grammar_inventory_learner ON grammar_inventory(learner_id);
CREATE INDEX idx_vocabulary_learner ON vocabulary(learner_id);
CREATE INDEX idx_expressions_learner ON expressions(learner_id);
CREATE INDEX idx_phrasing_suggestions_learner ON phrasing_suggestions(learner_id);
CREATE INDEX idx_learner_interests_learner ON learner_interests(learner_id);
CREATE INDEX idx_topic_cache_learner ON topic_cache(learner_id);

-- RLS policies — allow all (personal learning app)
ALTER TABLE learners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON learners FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON turns FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON error_patterns FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE grammar_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON grammar_inventory FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON vocabulary FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE avoidance_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON avoidance_patterns FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE learner_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON learner_interests FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE topic_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON topic_cache FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE expressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON expressions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE phrasing_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON phrasing_suggestions FOR ALL USING (true) WITH CHECK (true);
