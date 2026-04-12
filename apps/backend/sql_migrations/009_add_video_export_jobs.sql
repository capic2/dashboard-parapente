-- Video export jobs: durable background export queue/state
CREATE TABLE IF NOT EXISTS video_export_jobs (
    id VARCHAR PRIMARY KEY,
    flight_id VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    mode VARCHAR DEFAULT 'manual',
    quality VARCHAR DEFAULT '1080p',
    fps INTEGER DEFAULT 15,
    speed INTEGER DEFAULT 1,
    progress INTEGER DEFAULT 0,
    message TEXT,
    frontend_url VARCHAR,
    video_path VARCHAR,
    total_frames INTEGER,
    error TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    cancelled_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flight_id) REFERENCES flights (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_export_jobs_flight_id ON video_export_jobs (flight_id);
CREATE INDEX IF NOT EXISTS idx_video_export_jobs_status ON video_export_jobs (status);
CREATE INDEX IF NOT EXISTS idx_video_export_jobs_created_at ON video_export_jobs (created_at);
