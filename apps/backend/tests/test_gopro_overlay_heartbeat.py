from unittest.mock import Mock, patch

from gopro_overlay_export import _read_process_updates_from_process


def test_process_reader_refreshes_job_while_output_is_silent() -> None:
    process = Mock()
    process.poll.side_effect = [None, None, 0]
    process.stdout = Mock()
    process.stdout.read.return_value = ""

    with (
        patch("gopro_overlay_export._is_job_cancelled", return_value=False),
        patch("gopro_overlay_export._update_job") as update_job,
        patch("gopro_overlay_export.select.select", return_value=([], [], [])),
        patch("gopro_overlay_export.time.monotonic", side_effect=[0, 31, 32]),
    ):
        list(_read_process_updates_from_process(process, "job-id"))

    update_job.assert_called_once_with("job-id")
