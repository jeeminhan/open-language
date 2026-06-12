-- Open Language — JP curriculum source tables, learner state, and picker RPCs.
-- Run after supabase-add-user-id.sql so learners.user_id exists for RLS.

ALTER TABLE learners ADD COLUMN IF NOT EXISTS user_id uuid;

-- ── Source-derived and authored curriculum tables ───────────────────

CREATE TABLE IF NOT EXISTS snapshots (
  id text PRIMARY KEY,
  tag text NOT NULL UNIQUE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  picker_active boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS snapshots_one_active_idx
  ON snapshots(picker_active)
  WHERE picker_active = true;

CREATE TABLE IF NOT EXISTS vocab_items (
  id text PRIMARY KEY,
  headword text NOT NULL,
  primary_reading text,
  alt_readings text[] NOT NULL DEFAULT '{}'::text[],
  senses jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority_tags text[] NOT NULL DEFAULT '{}'::text[],
  jlpt_level text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  picker_eligible boolean NOT NULL DEFAULT true,
  source_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_id text NOT NULL REFERENCES snapshots(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS vocab_items_snapshot_headword_reading_idx
  ON vocab_items(snapshot_id, headword, coalesce(primary_reading, ''));

CREATE INDEX IF NOT EXISTS vocab_items_snapshot_tags_idx
  ON vocab_items USING gin(tags);

CREATE TABLE IF NOT EXISTS kanji_items (
  id text PRIMARY KEY,
  char text NOT NULL,
  on_readings text[] NOT NULL DEFAULT '{}'::text[],
  kun_readings text[] NOT NULL DEFAULT '{}'::text[],
  jlpt_level text,
  freq_rank integer,
  stroke_count integer,
  snapshot_id text NOT NULL REFERENCES snapshots(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS kanji_items_snapshot_char_idx
  ON kanji_items(snapshot_id, char);

CREATE TABLE IF NOT EXISTS frequency_ranks (
  vocab_id text NOT NULL REFERENCES vocab_items(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  source text NOT NULL,
  snapshot_id text NOT NULL REFERENCES snapshots(id),
  PRIMARY KEY (vocab_id, source, snapshot_id)
);

CREATE INDEX IF NOT EXISTS frequency_ranks_snapshot_rank_idx
  ON frequency_ranks(snapshot_id, source, rank);

CREATE TABLE IF NOT EXISTS example_sentences (
  id text PRIMARY KEY,
  jp_text text NOT NULL,
  en_text text NOT NULL,
  vocab_ids text[] NOT NULL DEFAULT '{}'::text[],
  grammar_ids text[] NOT NULL DEFAULT '{}'::text[],
  source text NOT NULL DEFAULT 'tatoeba',
  source_id text,
  quality text,
  snapshot_id text NOT NULL REFERENCES snapshots(id)
);

CREATE INDEX IF NOT EXISTS example_sentences_vocab_ids_idx
  ON example_sentences USING gin(vocab_ids);

CREATE INDEX IF NOT EXISTS example_sentences_grammar_ids_idx
  ON example_sentences USING gin(grammar_ids);

CREATE TABLE IF NOT EXISTS grammar_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  romaji text,
  jlpt_level text NOT NULL,
  gloss text NOT NULL,
  prereq_ids text[] NOT NULL DEFAULT '{}'::text[],
  dojg_ref_private text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  reviewed_at timestamptz,
  reviewed_by text
);

CREATE INDEX IF NOT EXISTS grammar_items_level_tags_idx
  ON grammar_items(jlpt_level);

CREATE INDEX IF NOT EXISTS grammar_items_tags_idx
  ON grammar_items USING gin(tags);

CREATE TABLE IF NOT EXISTS grammar_examples (
  id text PRIMARY KEY,
  grammar_id text NOT NULL REFERENCES grammar_items(id) ON DELETE CASCADE,
  jp_text text NOT NULL,
  en_text text NOT NULL,
  source text NOT NULL CHECK (source IN ('authored', 'tatoeba')),
  source_id text
);

CREATE TABLE IF NOT EXISTS vocab_kanji (
  vocab_id text NOT NULL REFERENCES vocab_items(id) ON DELETE CASCADE,
  kanji_id text NOT NULL REFERENCES kanji_items(id) ON DELETE CASCADE,
  PRIMARY KEY (vocab_id, kanji_id)
);

-- ── Learner curriculum state ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_known_vocab (
  learner_id text NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  vocab_id text NOT NULL REFERENCES vocab_items(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('unknown', 'introduced', 'practiced', 'mastered')),
  mastery_score double precision NOT NULL DEFAULT 0,
  last_seen timestamptz,
  evidence_session_id text REFERENCES sessions(id) ON DELETE SET NULL,
  snapshot_id text NOT NULL REFERENCES snapshots(id),
  PRIMARY KEY (learner_id, vocab_id, snapshot_id)
);

CREATE INDEX IF NOT EXISTS learner_known_vocab_picker_idx
  ON learner_known_vocab(learner_id, snapshot_id, status);

CREATE TABLE IF NOT EXISTS learner_known_grammar (
  learner_id text NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  grammar_id text NOT NULL REFERENCES grammar_items(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('unknown', 'introduced', 'practiced', 'mastered')),
  mastery_score double precision NOT NULL DEFAULT 0,
  last_seen timestamptz,
  evidence_session_id text REFERENCES sessions(id) ON DELETE SET NULL,
  snapshot_id text NOT NULL REFERENCES snapshots(id),
  PRIMARY KEY (learner_id, grammar_id, snapshot_id)
);

CREATE INDEX IF NOT EXISTS learner_known_grammar_picker_idx
  ON learner_known_grammar(learner_id, snapshot_id, status);

-- ── RLS ─────────────────────────────────────────────────────────────

ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanji_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequency_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE example_sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_kanji ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_known_vocab ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_known_grammar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curriculum_source_read" ON snapshots;
DROP POLICY IF EXISTS "curriculum_source_read" ON vocab_items;
DROP POLICY IF EXISTS "curriculum_source_read" ON kanji_items;
DROP POLICY IF EXISTS "curriculum_source_read" ON frequency_ranks;
DROP POLICY IF EXISTS "curriculum_source_read" ON example_sentences;
DROP POLICY IF EXISTS "curriculum_source_read" ON grammar_items;
DROP POLICY IF EXISTS "curriculum_source_read" ON grammar_examples;
DROP POLICY IF EXISTS "curriculum_source_read" ON vocab_kanji;

CREATE POLICY "curriculum_source_read" ON snapshots FOR SELECT USING (true);
CREATE POLICY "curriculum_source_read" ON vocab_items FOR SELECT USING (true);
CREATE POLICY "curriculum_source_read" ON kanji_items FOR SELECT USING (true);
CREATE POLICY "curriculum_source_read" ON frequency_ranks FOR SELECT USING (true);
CREATE POLICY "curriculum_source_read" ON example_sentences FOR SELECT USING (true);
CREATE POLICY "curriculum_source_read" ON grammar_items FOR SELECT USING (true);
CREATE POLICY "curriculum_source_read" ON grammar_examples FOR SELECT USING (true);
CREATE POLICY "curriculum_source_read" ON vocab_kanji FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_own_curriculum_vocab" ON learner_known_vocab;
DROP POLICY IF EXISTS "users_own_curriculum_grammar" ON learner_known_grammar;

CREATE POLICY "users_own_curriculum_vocab" ON learner_known_vocab
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_curriculum_grammar" ON learner_known_grammar
  FOR ALL USING (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  ) WITH CHECK (
    learner_id IN (SELECT id FROM learners WHERE user_id = auth.uid())
  );

-- ── Bootstrap learner_state after level test ────────────────────────

CREATE OR REPLACE FUNCTION bootstrap_learner_curriculum_state(
  p_learner_id text,
  p_cefr_level text,
  p_snapshot_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_id text;
  v_vocab_limit integer;
  v_mastered_levels text[] := '{}'::text[];
  v_active_level text;
  v_vocab_count integer := 0;
  v_mastered_grammar_count integer := 0;
  v_unknown_grammar_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM learners WHERE id = p_learner_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'learner not found for current user';
  END IF;

  SELECT id INTO v_snapshot_id
  FROM snapshots
  WHERE (p_snapshot_id IS NOT NULL AND id = p_snapshot_id)
     OR (p_snapshot_id IS NULL AND picker_active = true)
  ORDER BY picker_active DESC, taken_at DESC
  LIMIT 1;

  IF v_snapshot_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'no active curriculum snapshot',
      'placement', p_cefr_level
    );
  END IF;

  CASE upper(coalesce(p_cefr_level, 'A2'))
    WHEN 'A1' THEN
      v_vocab_limit := 500;
      v_mastered_levels := '{}'::text[];
      v_active_level := 'N5';
    WHEN 'A2' THEN
      v_vocab_limit := 1500;
      v_mastered_levels := ARRAY['N5'];
      v_active_level := 'N4';
    WHEN 'B1' THEN
      v_vocab_limit := 3000;
      v_mastered_levels := ARRAY['N5', 'N4'];
      v_active_level := 'N3';
    WHEN 'B2' THEN
      v_vocab_limit := 6000;
      v_mastered_levels := ARRAY['N5', 'N4', 'N3'];
      v_active_level := 'N2';
    WHEN 'C1' THEN
      v_vocab_limit := 10000;
      v_mastered_levels := ARRAY['N5', 'N4', 'N3', 'N2'];
      v_active_level := 'N1';
    ELSE
      v_vocab_limit := 10000;
      v_mastered_levels := ARRAY['N5', 'N4', 'N3', 'N2', 'N1'];
      v_active_level := 'N1';
  END CASE;

  INSERT INTO learner_known_vocab (
    learner_id,
    vocab_id,
    status,
    mastery_score,
    last_seen,
    snapshot_id
  )
  SELECT
    p_learner_id,
    vi.id,
    'mastered',
    1,
    now(),
    v_snapshot_id
  FROM vocab_items vi
  JOIN frequency_ranks fr
    ON fr.vocab_id = vi.id
   AND fr.snapshot_id = v_snapshot_id
   AND fr.source = 'jpdb'
  WHERE vi.snapshot_id = v_snapshot_id
    AND fr.rank <= v_vocab_limit
  ON CONFLICT (learner_id, vocab_id, snapshot_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    mastery_score = EXCLUDED.mastery_score,
    last_seen = EXCLUDED.last_seen;
  GET DIAGNOSTICS v_vocab_count = ROW_COUNT;

  INSERT INTO learner_known_grammar (
    learner_id,
    grammar_id,
    status,
    mastery_score,
    last_seen,
    snapshot_id
  )
  SELECT
    p_learner_id,
    gi.id,
    'mastered',
    1,
    now(),
    v_snapshot_id
  FROM grammar_items gi
  WHERE gi.reviewed_at IS NOT NULL
    AND gi.jlpt_level = ANY(v_mastered_levels)
  ON CONFLICT (learner_id, grammar_id, snapshot_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    mastery_score = EXCLUDED.mastery_score,
    last_seen = EXCLUDED.last_seen;
  GET DIAGNOSTICS v_mastered_grammar_count = ROW_COUNT;

  IF NOT v_active_level = ANY(v_mastered_levels) THEN
    INSERT INTO learner_known_grammar (
      learner_id,
      grammar_id,
      status,
      mastery_score,
      snapshot_id
    )
    SELECT
      p_learner_id,
      gi.id,
      'unknown',
      0,
      v_snapshot_id
    FROM grammar_items gi
    WHERE gi.reviewed_at IS NOT NULL
      AND gi.jlpt_level = v_active_level
    ON CONFLICT (learner_id, grammar_id, snapshot_id)
    DO NOTHING;
    GET DIAGNOSTICS v_unknown_grammar_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'snapshotId', v_snapshot_id,
    'placement', v_active_level,
    'masteredVocabRank', v_vocab_limit,
    'masteredVocabRows', v_vocab_count,
    'masteredGrammarRows', v_mastered_grammar_count,
    'unknownGrammarRows', v_unknown_grammar_count
  );
END;
$$;

-- ── Deterministic v1 picker ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION pick_next_curriculum_items(
  p_learner_id text,
  p_scenario_id text DEFAULT 'koenji-coffee-shop',
  p_scenario_label text DEFAULT 'Koenji coffee shop',
  p_scenario_tags text[] DEFAULT ARRAY['food', 'polite', 'transactional', 'everyday'],
  p_vocab_budget integer DEFAULT 5,
  p_grammar_budget integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_id text;
  v_vocab jsonb := '[]'::jsonb;
  v_grammar jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM learners WHERE id = p_learner_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'learner not found for current user';
  END IF;

  SELECT id INTO v_snapshot_id
  FROM snapshots
  WHERE picker_active = true
  ORDER BY taken_at DESC
  LIMIT 1;

  IF v_snapshot_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(jsonb_agg(item), '[]'::jsonb)
  INTO v_vocab
  FROM (
    SELECT jsonb_build_object(
      'id', ranked.id,
      'headword', ranked.headword,
      'primaryReading', ranked.primary_reading,
      'gloss', ranked.gloss,
      'frequencyRank', ranked.rank,
      'jlptLevel', ranked.jlpt_level,
      'tags', ranked.tags,
      'attribution', 'JMdict + JPDB'
    ) AS item
    FROM (
      SELECT
        vi.id,
        vi.headword,
        vi.primary_reading,
        coalesce(
          vi.senses #>> '{0,glosses,0}',
          vi.senses #>> '{0,gloss,0}',
          vi.senses #>> '{0,0}',
          vi.headword
        ) AS gloss,
        vi.jlpt_level,
        vi.tags,
        fr.rank,
        CASE WHEN vi.tags && p_scenario_tags THEN 1.0 ELSE 0.3 END AS scenario_score
      FROM vocab_items vi
      JOIN frequency_ranks fr
        ON fr.vocab_id = vi.id
       AND fr.snapshot_id = v_snapshot_id
       AND fr.source = 'jpdb'
      LEFT JOIN learner_known_vocab lkv
        ON lkv.learner_id = p_learner_id
       AND lkv.vocab_id = vi.id
       AND lkv.snapshot_id = v_snapshot_id
      WHERE vi.snapshot_id = v_snapshot_id
        AND vi.picker_eligible = true
        AND coalesce(lkv.status, 'unknown') = 'unknown'
      ORDER BY scenario_score DESC, fr.rank ASC, vi.headword ASC
      LIMIT greatest(1, least(coalesce(p_vocab_budget, 5), 20))
    ) ranked
  ) picked;

  SELECT coalesce(jsonb_agg(item), '[]'::jsonb)
  INTO v_grammar
  FROM (
    SELECT jsonb_build_object(
      'id', ranked.id,
      'name', ranked.name,
      'romaji', ranked.romaji,
      'jlptLevel', ranked.jlpt_level,
      'gloss', ranked.gloss,
      'tags', ranked.tags,
      'attribution', 'open-language authored skeleton'
    ) AS item
    FROM (
      SELECT
        gi.id,
        gi.name,
        gi.romaji,
        gi.jlpt_level,
        gi.gloss,
        gi.tags,
        CASE WHEN gi.tags && p_scenario_tags THEN 1.0 ELSE 0.3 END AS scenario_score
      FROM grammar_items gi
      LEFT JOIN learner_known_grammar lkg
        ON lkg.learner_id = p_learner_id
       AND lkg.grammar_id = gi.id
       AND lkg.snapshot_id = v_snapshot_id
      WHERE gi.reviewed_at IS NOT NULL
        AND coalesce(lkg.status, 'unknown') = 'unknown'
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(gi.prereq_ids) prereq_id
          LEFT JOIN learner_known_grammar prereq
            ON prereq.learner_id = p_learner_id
           AND prereq.grammar_id = prereq_id
           AND prereq.snapshot_id = v_snapshot_id
          WHERE coalesce(prereq.status, 'unknown') NOT IN ('practiced', 'mastered')
        )
      ORDER BY scenario_score DESC, gi.jlpt_level DESC, gi.name ASC
      LIMIT greatest(1, least(coalesce(p_grammar_budget, 1), 5))
    ) ranked
  ) picked;

  RETURN jsonb_build_object(
    'snapshotId', v_snapshot_id,
    'scenarioId', p_scenario_id,
    'scenarioLabel', p_scenario_label,
    'scenarioTags', p_scenario_tags,
    'explanation', 'unknown items ordered by JPDB rank, scenario tag overlap, and grammar prereqs',
    'fallback', false,
    'vocab', v_vocab,
    'grammar', v_grammar,
    'attribution', jsonb_build_array(
      jsonb_build_object(
        'source', 'jmdict',
        'label', 'JMdict',
        'license', 'CC BY-SA 4.0',
        'url', 'https://www.edrdg.org/jmdict/edict_doc.html'
      ),
      jsonb_build_object(
        'source', 'jpdb',
        'label', 'JPDB frequency list',
        'license', 'freely downloadable, attribution required',
        'url', 'https://jpdb.io'
      ),
      jsonb_build_object(
        'source', 'authored',
        'label', 'open-language JLPT grammar skeleton',
        'license', 'CC BY 4.0',
        'url', '/about/data'
      )
    )
  );
END;
$$;
