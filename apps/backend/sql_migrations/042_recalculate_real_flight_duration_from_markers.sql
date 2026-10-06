-- Keep the stored duration aligned with the shared video timeline used by
-- calculate_real_flight_duration_minutes(). A takeoff and landing can be
-- marked while viewing different associated videos, so do not group by video.
UPDATE flights
SET real_duration_minutes = (
    SELECT CASE
        WHEN takeoff_seconds IS NOT NULL
            AND landing_seconds IS NOT NULL
            AND landing_seconds > takeoff_seconds
        THEN CAST(round((landing_seconds - takeoff_seconds) / 60.0) AS INTEGER)
        ELSE NULL
    END
    FROM (
        SELECT
            min(
                CASE
                    WHEN json_extract(marker.value, '$.kind') = 'takeoff'
                        AND json_type(marker.value, '$.timestamp_seconds') = 'integer'
                        AND cast(json_extract(marker.value, '$.timestamp_seconds') AS INTEGER) >= 0
                    THEN cast(json_extract(marker.value, '$.timestamp_seconds') AS INTEGER)
                END
            ) AS takeoff_seconds,
            max(
                CASE
                    WHEN json_extract(marker.value, '$.kind') = 'landing'
                        AND json_type(marker.value, '$.timestamp_seconds') = 'integer'
                        AND cast(json_extract(marker.value, '$.timestamp_seconds') AS INTEGER) >= 0
                    THEN cast(json_extract(marker.value, '$.timestamp_seconds') AS INTEGER)
                END
            ) AS landing_seconds
        FROM json_each(
            CASE
                WHEN json_valid(flights.video_markers) THEN flights.video_markers
                ELSE '[]'
            END
        ) AS marker
    ) AS marker_times
);
