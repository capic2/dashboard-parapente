-- Persist the hardware method selected by the highlight video worker.
ALTER TABLE highlight_video_jobs ADD COLUMN render_method VARCHAR;
