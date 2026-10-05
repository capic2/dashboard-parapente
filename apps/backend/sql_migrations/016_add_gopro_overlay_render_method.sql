-- Record whether a GoPro overlay job uses CPU or GPU rendering.
ALTER TABLE gopro_overlay_jobs ADD COLUMN render_method VARCHAR;
