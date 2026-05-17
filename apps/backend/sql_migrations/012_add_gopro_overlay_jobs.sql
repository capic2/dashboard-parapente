-- Durable GoPro overlay render jobs
CREATE TABLE IF NOT EXISTS gopro_overlay_jobs (
    id VARCHAR PRIMARY KEY,
    status VARCHAR NOT NULL,
    progress INTEGER DEFAULT 0,
    message TEXT,
    error TEXT,
    video_path VARCHAR NOT NULL,
    gpx_path VARCHAR NOT NULL,
    pip_path VARCHAR,
    layout_id VARCHAR NOT NULL,
    layout_label VARCHAR NOT NULL,
    layout_path VARCHAR NOT NULL,
    output_path VARCHAR NOT NULL,
    temp_output_path VARCHAR NOT NULL,
    output_filename VARCHAR NOT NULL,
    log_path VARCHAR,
    command_json TEXT,
    video_width INTEGER,
    video_height INTEGER,
    started_at DATETIME,
    completed_at DATETIME,
    cancelled_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gopro_overlay_jobs_status ON gopro_overlay_jobs (status);
CREATE INDEX IF NOT EXISTS idx_gopro_overlay_jobs_created_at ON gopro_overlay_jobs (created_at);
