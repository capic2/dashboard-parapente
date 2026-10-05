CREATE TABLE IF NOT EXISTS youtube_credentials (
    user_id INTEGER PRIMARY KEY,
    refresh_token_encrypted TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS youtube_upload_jobs (
    id VARCHAR PRIMARY KEY,
    flight_id VARCHAR NOT NULL,
    user_id INTEGER NOT NULL,
    status VARCHAR NOT NULL,
    progress INTEGER DEFAULT 0 NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '' NOT NULL,
    privacy_status VARCHAR(16) DEFAULT 'private' NOT NULL,
    upload_session_encrypted TEXT,
    youtube_video_id VARCHAR(32),
    youtube_url VARCHAR,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    started_at DATETIME,
    completed_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (flight_id) REFERENCES flights (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_youtube_upload_jobs_flight_id
ON youtube_upload_jobs (flight_id);

CREATE INDEX IF NOT EXISTS idx_youtube_upload_jobs_status
ON youtube_upload_jobs (status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_youtube_upload_jobs_active_flight
ON youtube_upload_jobs (flight_id)
WHERE status IN ('queued', 'uploading');
