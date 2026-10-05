import pytest
from pydantic import ValidationError

from schemas import HighlightVideoDeleteResponse


def test_highlight_video_delete_response_accepts_zero_and_positive_counts() -> None:
    assert (
        HighlightVideoDeleteResponse(job_id="job-1", deleted=True, files_deleted=0).files_deleted
        == 0
    )
    assert (
        HighlightVideoDeleteResponse(job_id="job-1", deleted=True, files_deleted=2).files_deleted
        == 2
    )


def test_highlight_video_delete_response_rejects_negative_counts() -> None:
    with pytest.raises(ValidationError):
        HighlightVideoDeleteResponse(job_id="job-1", deleted=True, files_deleted=-1)
