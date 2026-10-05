import numpy as np

from visual_event_detector import classify_motion_mask


def test_motion_detector_finds_wing_movement():
    previous = np.zeros((100, 100), dtype=np.uint8)
    current = previous.copy()
    current[40:60, 40:60] = 255

    events = classify_motion_mask(previous, current)

    assert any(event.category == "wing_movement" for event in events)


def test_motion_detector_rejects_identical_frames():
    frame = np.full((100, 100), 120, dtype=np.uint8)

    assert classify_motion_mask(frame, frame) == []
