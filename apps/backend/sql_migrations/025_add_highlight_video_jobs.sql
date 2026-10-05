CREATE TABLE IF NOT EXISTS highlight_video_jobs (
    id VARCHAR PRIMARY KEY NOT NULL,
    flight_id VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    error TEXT,
    source_video_path VARCHAR NOT NULL,
    overlay_video_path VARCHAR,
    output_path VARCHAR,
    selection_json TEXT,
    output_format VARCHAR NOT NULL DEFAULT 'original',
    overlay_offset_seconds FLOAT NOT NULL DEFAULT 0.0,
    started_at DATETIME,
    completed_at DATETIME,
    cancelled_at DATETIME,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_highlight_video_jobs_flight_id
    ON highlight_video_jobs(flight_id);

CREATE INDEX IF NOT EXISTS idx_highlight_video_jobs_status
    ON highlight_video_jobs(status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_highlight_video_jobs_active_flight
    ON highlight_video_jobs(flight_id)
    WHERE status IN ('queued', 'running');
