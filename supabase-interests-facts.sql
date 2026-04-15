-- Add learned-facts JSON column to learner_interests.
-- Each interest row can accumulate short, timestamped facts the tutor learns
-- about the learner over time (e.g. favorite member, denomination, genre).
--
-- Shape: [{ "fact": "favorite member is Jimin", "source": "chat|structured|manual", "ts": "2026-04-13T12:34:56Z" }]

ALTER TABLE learner_interests
  ADD COLUMN IF NOT EXISTS facts jsonb DEFAULT '[]'::jsonb;
