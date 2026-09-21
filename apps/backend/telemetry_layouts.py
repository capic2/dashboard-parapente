"""Validation and defaults for the internal interactive telemetry layout XML."""

from __future__ import annotations

import math
import xml.etree.ElementTree as ET

DEFAULT_TELEMETRY_LAYOUT_XML = """<telemetry-layout version=\"1\" width=\"1920\" height=\"1080\">
  <widget id=\"top-left\" metric=\"altitude\" x=\"0.02\" y=\"0.02\" width=\"0.16\" height=\"0.10\" visible=\"true\" />
  <widget id=\"top-right\" metric=\"speed\" x=\"0.82\" y=\"0.02\" width=\"0.16\" height=\"0.10\" visible=\"true\" />
  <widget id=\"bottom-left\" metric=\"vario\" x=\"0.02\" y=\"0.82\" width=\"0.16\" height=\"0.10\" visible=\"true\" />
  <widget id=\"bottom-right\" metric=\"distance\" x=\"0.82\" y=\"0.82\" width=\"0.16\" height=\"0.10\" visible=\"true\" />
</telemetry-layout>"""

VALID_METRICS = {
    "altitude",
    "altitude_min",
    "altitude_max",
    "start_altitude",
    "speed",
    "vario",
    "vario_min",
    "vario_max",
    "distance",
    "heading",
    "heart_rate",
    "heart_rate_min",
    "heart_rate_max",
    "power",
    "total_gain",
    "total_loss",
    "datetime",
}
VALID_ICONS = {
    "mountain",
    "wind",
    "heart",
    "heartbeat",
    "compass",
    "map-pin",
    "flame",
    "gauge",
    "slope",
    "slope-triangle",
}
MAX_TELEMETRY_WIDGETS = 16
VALID_INTERACTION_ACTIONS = {"none", "cycle_metric"}
VALID_WIDGET_VARIANTS = {"value", "speedometer"}
VALID_VALUE_ALIGNMENTS = {"left", "center", "right"}


def validate_telemetry_layout_xml(xml_content: str) -> str:
    """Validate and normalize an editor XML document."""
    if not isinstance(xml_content, str) or len(xml_content) > 500_000:
        raise ValueError("Telemetry layout XML is invalid or too large")
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as exc:
        raise ValueError("Telemetry layout XML is not well formed") from exc

    if root.tag != "telemetry-layout" or root.attrib.get("version") != "1":
        raise ValueError("Telemetry layout XML must use version 1")
    if root.attrib.get("width") != "1920" or root.attrib.get("height") != "1080":
        raise ValueError("Telemetry layout canvas must be 1920x1080")
    background_image = root.attrib.get("background-image")
    if background_image is not None and (
        not background_image.startswith("data:image/") or len(background_image) > 450_000
    ):
        raise ValueError("Telemetry layout background image is invalid")

    children = list(root)
    groups = [child for child in children if child.tag == "group"]
    widgets = [child for child in children if child.tag in {"widget", "icon", "text"}]
    group_ids = {group.attrib.get("id", "") for group in groups}
    if (
        not 1 <= len(widgets) <= MAX_TELEMETRY_WIDGETS
        or len(group_ids) != len(groups)
        or "" in group_ids
        or any(child.tag not in {"widget", "icon", "text", "group"} for child in children)
    ):
        raise ValueError(
            f"Telemetry layout must contain between 1 and {MAX_TELEMETRY_WIDGETS} widgets"
        )
    ids: set[str] = set()
    for widget in widgets:
        widget_id = widget.attrib.get("id", "")
        if not widget_id or widget_id in ids:
            raise ValueError("Telemetry widget ids must be unique")
        ids.add(widget_id)
        if widget.tag == "widget" and widget.attrib.get("metric") not in VALID_METRICS:
            raise ValueError("Telemetry widget metric is not supported")
        if widget.tag == "icon" and widget.attrib.get("name") not in VALID_ICONS:
            raise ValueError("Telemetry icon is not supported")
        if widget.tag == "text":
            content = widget.attrib.get("content", "")
            if not content or len(content) > 500:
                raise ValueError("Telemetry text must contain 1 to 500 characters")
        element_name = widget.attrib.get("label")
        if element_name is not None and not 1 <= len(element_name) <= 100:
            raise ValueError("Telemetry element names must contain 1 to 100 characters")
        group_id = widget.attrib.get("group")
        if group_id and group_id not in group_ids:
            raise ValueError("Telemetry widget group does not exist")
        if widget.attrib.get("background") not in {None, "transparent"}:
            raise ValueError("Telemetry element background is invalid")
        if widget.attrib.get("border") not in {None, "true", "false"}:
            raise ValueError("Telemetry element border is invalid")
        if widget.attrib.get("label-visible") not in {None, "true", "false"}:
            raise ValueError("Telemetry widget label visibility is invalid")
        if widget.tag == "widget":
            variant = widget.attrib.get("variant")
            if variant is not None and variant not in VALID_WIDGET_VARIANTS:
                raise ValueError("Telemetry widget variant is invalid")
            alignment = widget.attrib.get("align")
            if alignment is not None and alignment not in VALID_VALUE_ALIGNMENTS:
                raise ValueError("Telemetry widget value alignment is invalid")
            for action_name in ("click-action", "long-press-action"):
                action = widget.attrib.get(action_name)
                if action is not None and action not in VALID_INTERACTION_ACTIONS:
                    raise ValueError("Telemetry widget interaction action is invalid")
        if "font-size" in widget.attrib:
            try:
                font_size = float(widget.attrib["font-size"])
            except (TypeError, ValueError) as exc:
                raise ValueError("Telemetry widget font size is invalid") from exc
            if not math.isfinite(font_size) or not 8 <= font_size <= 160:
                raise ValueError("Telemetry widget font size must be between 8 and 160")
        for name in ("x", "y", "width", "height"):
            try:
                value = float(widget.attrib[name])
            except (KeyError, TypeError, ValueError) as exc:
                raise ValueError(f"Telemetry widget {name} must be numeric") from exc
            if not math.isfinite(value) or value < 0 or value > 1:
                raise ValueError(f"Telemetry widget {name} must be between 0 and 1")
        if float(widget.attrib["x"]) + float(widget.attrib["width"]) > 1:
            raise ValueError("Telemetry widget exceeds the canvas width")
        if float(widget.attrib["y"]) + float(widget.attrib["height"]) > 1:
            raise ValueError("Telemetry widget exceeds the canvas height")
        if widget.attrib.get("visible") not in {"true", "false"}:
            raise ValueError("Telemetry widget visibility is invalid")
    for group in groups:
        group_name = group.attrib.get("name")
        if group_name is not None and not 1 <= len(group_name) <= 100:
            raise ValueError("Telemetry group names must contain 1 to 100 characters")

    return ET.tostring(root, encoding="unicode")
