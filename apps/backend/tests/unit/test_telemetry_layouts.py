import pytest

from telemetry_layouts import DEFAULT_TELEMETRY_LAYOUT_XML, validate_telemetry_layout_xml


def test_default_layout_is_valid() -> None:
    assert validate_telemetry_layout_xml(DEFAULT_TELEMETRY_LAYOUT_XML).startswith(
        "<telemetry-layout"
    )


@pytest.mark.parametrize(
    "xml",
    [
        "<layout />",
        DEFAULT_TELEMETRY_LAYOUT_XML.replace('metric="altitude"', 'metric="unknown"'),
        DEFAULT_TELEMETRY_LAYOUT_XML.replace('x="0.02"', 'x="1.2"'),
        DEFAULT_TELEMETRY_LAYOUT_XML.replace("</telemetry-layout>", ""),
    ],
)
def test_invalid_layouts_are_rejected(xml: str) -> None:
    with pytest.raises(ValueError):
        validate_telemetry_layout_xml(xml)
