-- Store the canonical YouTube links attached to a flight as a JSON array.
ALTER TABLE flights ADD COLUMN youtube_urls TEXT NOT NULL DEFAULT '[]';
