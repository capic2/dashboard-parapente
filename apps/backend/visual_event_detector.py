"""Lightweight visual event detection primitives for pano highlight selection."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True, slots=True)
class VisualEvent:
    category: str
    confidence: float


def _component_sizes(mask: np.ndarray) -> list[int]:
    """Find coarse connected components without adding an OpenCV dependency."""
    seen = np.zeros(mask.shape, dtype=bool)
    sizes: list[int] = []
    height, width = mask.shape
    for row, column in zip(*np.nonzero(mask), strict=False):
        if seen[row, column]:
            continue
        stack = [(int(row), int(column))]
        seen[row, column] = True
        size = 0
        while stack:
            current_row, current_column = stack.pop()
            size += 1
            for next_row, next_column in (
                (current_row - 1, current_column),
                (current_row + 1, current_column),
                (current_row, current_column - 1),
                (current_row, current_column + 1),
            ):
                if (
                    0 <= next_row < height
                    and 0 <= next_column < width
                    and mask[next_row, next_column]
                    and not seen[next_row, next_column]
                ):
                    seen[next_row, next_column] = True
                    stack.append((next_row, next_column))
        sizes.append(size)
    return sizes


def classify_motion_mask(previous: np.ndarray, current: np.ndarray) -> list[VisualEvent]:
    """Classify coarse motion patterns from two grayscale projections.

    This is deliberately conservative: a possible second moving object is
    marked as a candidate and must be confirmed by a stronger detector later.
    """
    if previous.shape != current.shape or previous.ndim != 2:
        raise ValueError("motion frames must be same-shaped grayscale images")
    difference = np.abs(current.astype(np.int16) - previous.astype(np.int16))
    threshold = max(18, float(np.percentile(difference, 90)))
    mask = difference >= threshold
    mask[: max(1, mask.shape[0] // 20), :] = False
    mask[-max(1, mask.shape[0] // 20) :, :] = False
    mask[:, : max(1, mask.shape[1] // 30)] = False
    mask[:, -max(1, mask.shape[1] // 30) :] = False
    component_sizes = _component_sizes(mask)
    if not component_sizes:
        return []
    useful_components = [size for size in component_sizes if size >= mask.size * 0.002]
    if not useful_components:
        return []
    motion_ratio = float(mask.mean())
    events = [VisualEvent("wing_movement", min(1.0, motion_ratio * 8))]
    if len(useful_components) >= 2 and motion_ratio < 0.25:
        events.append(VisualEvent("other_glider_candidate", min(0.85, len(useful_components) / 8)))
    return events
