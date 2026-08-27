import pytest
from pydantic import ValidationError

from schemas import HighlightVideoCreateRequest, HighlightVideoDeleteResponse
from routes import _normalize_highlight_prompt


def test_highlight_video_create_request_accepts_and_limits_prompt() -> None:
    assert (
        HighlightVideoCreateRequest(prompt="Prioritize the thermal").prompt
        == "Prioritize the thermal"
    )

    with pytest.raises(ValidationError):
        HighlightVideoCreateRequest(prompt="x" * 4001)


def test_highlight_prompt_normalization_discards_whitespace_only_input() -> None:
    assert _normalize_highlight_prompt("  thermal moments  ") == "thermal moments"
    assert _normalize_highlight_prompt(" \n\t ") is None
    assert _normalize_highlight_prompt(None) is None


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
