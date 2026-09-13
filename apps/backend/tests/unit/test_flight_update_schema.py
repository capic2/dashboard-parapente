import math

import pytest
from pydantic import ValidationError

from schemas import FlightUpdate


def test_flight_update_accepts_a_finite_gopro_overlay_offset() -> None:
    update = FlightUpdate(gopro_overlay_gpx_offset=-12.5)

    assert update.gopro_overlay_gpx_offset == -12.5


@pytest.mark.parametrize("offset", [math.inf, -math.inf, math.nan])
def test_flight_update_rejects_a_non_finite_gopro_overlay_offset(
    offset: float,
) -> None:
    with pytest.raises(ValidationError, match="gopro_overlay_gpx_offset"):
        FlightUpdate(gopro_overlay_gpx_offset=offset)
