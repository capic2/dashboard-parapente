CREATE TABLE IF NOT EXISTS telemetry_layouts (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flight_id TEXT REFERENCES flights(id) ON DELETE CASCADE,
    xml_content TEXT NOT NULL,
    format_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_telemetry_layouts_default_user
    ON telemetry_layouts(user_id)
    WHERE flight_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_telemetry_layouts_flight_user
    ON telemetry_layouts(user_id, flight_id)
    WHERE flight_id IS NOT NULL;
