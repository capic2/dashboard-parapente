CREATE TABLE IF NOT EXISTS background_operations (
    id VARCHAR PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    operation_type VARCHAR(64) NOT NULL,
    title_key VARCHAR(128) NOT NULL,
    status VARCHAR(16) NOT NULL,
    progress INTEGER,
    current_step_key VARCHAR(128),
    current_step_progress INTEGER,
    current_step_detail TEXT,
    steps_json TEXT NOT NULL DEFAULT '[]',
    result_json TEXT,
    error_key VARCHAR(128),
    error_detail TEXT,
    source_kind VARCHAR(64),
    source_id VARCHAR,
    can_cancel BOOLEAN NOT NULL DEFAULT 0,
    can_retry BOOLEAN NOT NULL DEFAULT 0,
    read_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_background_operations_user_status
    ON background_operations(user_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_background_operations_expiry
    ON background_operations(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_background_operations_source
    ON background_operations(user_id, source_kind, source_id)
    WHERE source_kind IS NOT NULL AND source_id IS NOT NULL;
