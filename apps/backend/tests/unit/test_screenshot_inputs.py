from llm.screenshot_inputs import ScreenshotInput, normalize_screenshot_inputs


def test_normalize_screenshot_inputs_supports_paths_and_sources() -> None:
    screenshot_paths: list[ScreenshotInput] = [
        "/tmp/emagram-1.png",
        {"path": "/tmp/emagram-2.png"},
        {"image_path": "/tmp/emagram-3.png"},
        {"source": "meteociel", "path": "/tmp/emagram-4.png"},
        {"source": "empty"},
    ]

    assert normalize_screenshot_inputs(screenshot_paths) == [
        {"source": "image-1", "path": "/tmp/emagram-1.png"},
        {"source": "image-2", "path": "/tmp/emagram-2.png"},
        {"source": "image-3", "path": "/tmp/emagram-3.png"},
        {"source": "meteociel", "path": "/tmp/emagram-4.png"},
    ]
