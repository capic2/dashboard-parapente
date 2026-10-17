CREATE TABLE IF NOT EXISTS sportstracklive_credentials (
    user_id INTEGER PRIMARY KEY,
    upload_key_encrypted TEXT NOT NULL,
    auto_upload BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE flights ADD COLUMN sportstracklive_status VARCHAR;
ALTER TABLE flights ADD COLUMN sportstracklive_track_id INTEGER;
ALTER TABLE flights ADD COLUMN sportstracklive_error TEXT;
ALTER TABLE flights ADD COLUMN sportstracklive_upload_started_at DATETIME;
ALTER TABLE flights ADD COLUMN sportstracklive_uploaded_at DATETIME;
