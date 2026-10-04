ALTER TABLE flights ADD COLUMN real_duration_minutes INTEGER;

UPDATE flights
SET real_duration_minutes = (
    SELECT round(max(landing.landing_seconds - takeoff.takeoff_seconds) / 60.0)
    FROM (
        SELECT
            json_extract(marker.value, '$.youtube_video_id') AS video_id,
            min(cast(json_extract(marker.value, '$.timestamp_seconds') AS INTEGER)) AS takeoff_seconds
        FROM json_each(flights.video_markers) AS marker
        WHERE json_extract(marker.value, '$.kind') = 'takeoff'
        GROUP BY json_extract(marker.value, '$.youtube_video_id')
    ) AS takeoff
    JOIN (
        SELECT
            json_extract(marker.value, '$.youtube_video_id') AS video_id,
            max(cast(json_extract(marker.value, '$.timestamp_seconds') AS INTEGER)) AS landing_seconds
        FROM json_each(flights.video_markers) AS marker
        WHERE json_extract(marker.value, '$.kind') = 'landing'
        GROUP BY json_extract(marker.value, '$.youtube_video_id')
    ) AS landing ON landing.video_id = takeoff.video_id
    WHERE landing.landing_seconds > takeoff.takeoff_seconds
);
