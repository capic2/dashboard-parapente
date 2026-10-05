-- Add structured site information and post-flight pilot context fields.
ALTER TABLE sites ADD COLUMN practical_info TEXT NOT NULL DEFAULT '{}';
ALTER TABLE flights ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE flights ADD COLUMN conditions_feedback TEXT;
ALTER TABLE flights ADD COLUMN decision_snapshot TEXT;
