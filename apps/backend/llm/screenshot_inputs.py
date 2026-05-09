"""Helpers for LLM emagram screenshot inputs."""

ScreenshotInput = str | dict[str, str]


def normalize_screenshot_inputs(
    screenshot_paths: list[ScreenshotInput],
) -> list[dict[str, str]]:
    screenshots: list[dict[str, str]] = []
    for index, screenshot in enumerate(screenshot_paths, start=1):
        fallback_source = f"image-{index}"
        if isinstance(screenshot, str):
            screenshots.append({"source": fallback_source, "path": screenshot})
            continue

        path = screenshot.get("path") or screenshot.get("image_path") or ""
        if path:
            screenshots.append(
                {"source": screenshot.get("source") or fallback_source, "path": path}
            )
    return screenshots
