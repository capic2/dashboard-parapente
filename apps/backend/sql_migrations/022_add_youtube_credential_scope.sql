ALTER TABLE youtube_credentials
ADD COLUMN oauth_scope TEXT NOT NULL
DEFAULT 'https://www.googleapis.com/auth/youtube.upload';
