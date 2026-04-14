-- Add summary column for listen-mode session feedback paragraphs.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS summary text;
