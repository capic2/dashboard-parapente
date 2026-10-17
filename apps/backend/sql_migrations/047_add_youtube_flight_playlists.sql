CREATE TABLE IF NOT EXISTS youtube_flight_playlists (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flight_id TEXT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
    playlist_id TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, flight_id)
);

CREATE INDEX IF NOT EXISTS ix_youtube_flight_playlists_playlist_id
ON youtube_flight_playlists (playlist_id);
