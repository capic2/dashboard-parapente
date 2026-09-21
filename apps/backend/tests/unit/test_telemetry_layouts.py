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


def test_layout_rejects_invalid_widget_style() -> None:
    xml = DEFAULT_TELEMETRY_LAYOUT_XML.replace(
        'visible="true"', 'visible="true" background="gradient"', 1
    )

    with pytest.raises(ValueError):
        validate_telemetry_layout_xml(xml)


def test_layout_accepts_widget_font_size() -> None:
    xml = DEFAULT_TELEMETRY_LAYOUT_XML.replace(
        'metric="altitude"', 'metric="altitude" font-size="48"', 1
    )

    assert 'font-size="48"' in validate_telemetry_layout_xml(xml)


def test_layout_rejects_invalid_widget_font_size() -> None:
    xml = DEFAULT_TELEMETRY_LAYOUT_XML.replace(
        'metric="altitude"', 'metric="altitude" font-size="200"', 1
    )

    with pytest.raises(ValueError):
        validate_telemetry_layout_xml(xml)


def test_layout_accepts_embedded_background_image() -> None:
    xml = DEFAULT_TELEMETRY_LAYOUT_XML.replace(
        '<telemetry-layout version="1"',
        '<telemetry-layout background-image="data:image/png;base64,ZmFrZQ==" version="1"',
        1,
    )

    assert "background-image" in validate_telemetry_layout_xml(xml)


def test_layout_rejects_external_background_image() -> None:
    xml = DEFAULT_TELEMETRY_LAYOUT_XML.replace(
        '<telemetry-layout version="1"',
        '<telemetry-layout background-image="https://example.com/background.png" version="1"',
        1,
    )

    with pytest.raises(ValueError):
        validate_telemetry_layout_xml(xml)
