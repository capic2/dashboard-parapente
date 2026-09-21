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


def test_layouts_can_contain_added_widgets() -> None:
    xml = DEFAULT_TELEMETRY_LAYOUT_XML.replace(
        "</telemetry-layout>",
        '<widget id="extra" metric="heading" x="0.4" y="0.4" width="0.1" height="0.1" visible="true" /></telemetry-layout>',
    )

    assert 'id="extra"' in validate_telemetry_layout_xml(xml)


def test_layouts_can_contain_icons_and_groups() -> None:
    xml = DEFAULT_TELEMETRY_LAYOUT_XML.replace(
        '<widget id="top-left"',
        '<group id="flight-info" /><widget id="top-left" group="flight-info"',
    ).replace(
        "</telemetry-layout>",
        '<icon id="wind-icon" name="wind" group="flight-info" x="0.4" y="0.4" width="0.06" height="0.06" visible="true" /></telemetry-layout>',
    )

    assert 'name="wind"' in validate_telemetry_layout_xml(xml)


def test_layouts_can_contain_text() -> None:
    xml = DEFAULT_TELEMETRY_LAYOUT_XML.replace(
        "</telemetry-layout>",
        '<text id="title" label="Titre" content="Vol du matin" x="0.2" y="0.3" width="0.3" height="0.08" visible="true" /></telemetry-layout>',
    )

    assert 'content="Vol du matin"' in validate_telemetry_layout_xml(xml)
