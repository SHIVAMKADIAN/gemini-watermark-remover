"""Window generation and overlap crossfade.

Propagation quality degrades past a few hundred frames as flow error compounds,
so long clips are processed in overlapping windows and the overlaps are
cross-faded to hide the seam. This module is pure arithmetic + NumPy weights and
is fully unit-tested (`tests/test_chunking.py`).
"""

from __future__ import annotations

import numpy as np


def make_windows(num_frames: int, window: int, overlap: int) -> list[tuple[int, int]]:
    """Splits `num_frames` into [start, end) windows of length `window` with
    `overlap` frames shared between neighbours.

    Guarantees: every frame is covered, the last window ends exactly at
    `num_frames`, and consecutive windows share exactly `overlap` frames (except
    possibly the final shortened window).
    """
    if window <= 0:
        raise ValueError("window must be positive")
    if not 0 <= overlap < window:
        raise ValueError("overlap must satisfy 0 <= overlap < window")
    if num_frames <= 0:
        return []
    if num_frames <= window:
        return [(0, num_frames)]

    step = window - overlap
    windows: list[tuple[int, int]] = []
    start = 0
    while True:
        end = min(start + window, num_frames)
        windows.append((start, end))
        if end >= num_frames:
            break
        start += step
    return windows


def crossfade_weights(length: int, left_overlap: int, right_overlap: int) -> np.ndarray:
    """Per-frame blend weight in [0,1] for one window of `length` frames.

    Frames in the leading overlap ramp 0->1, the trailing overlap ramps 1->0,
    and the core is 1. When two adjacent windows' weights are laid over the same
    frames, the shared-overlap weights sum to 1, so a weighted average is a true
    crossfade with no brightness dip.
    """
    w = np.ones(length, dtype=np.float32)
    for i in range(min(left_overlap, length)):
        # ramp 0..1 across the left overlap (exclusive of 0 so the seam blends)
        w[i] = (i + 1) / (left_overlap + 1)
    for i in range(min(right_overlap, length)):
        w[length - 1 - i] = min(w[length - 1 - i], (i + 1) / (right_overlap + 1))
    return w


def blend_windows(
    frame_shape: tuple[int, ...],
    windows: list[tuple[int, int]],
    window_frames: list[np.ndarray],
    overlap: int,
) -> np.ndarray:
    """Reassembles per-window frame stacks into one clip via crossfaded overlaps.

    `window_frames[k]` is the processed (float or uint8) stack for `windows[k]`,
    shaped (len, *frame_shape). Returns a (num_frames, *frame_shape) float32 clip.
    """
    num_frames = windows[-1][1]
    acc = np.zeros((num_frames, *frame_shape), dtype=np.float64)
    wacc = np.zeros((num_frames, *([1] * len(frame_shape))), dtype=np.float64)

    for k, (start, end) in enumerate(windows):
        length = end - start
        left = overlap if k > 0 else 0
        right = overlap if k < len(windows) - 1 else 0
        w = crossfade_weights(length, left, right).astype(np.float64)
        w_b = w.reshape((length, *([1] * len(frame_shape))))
        acc[start:end] += window_frames[k].astype(np.float64) * w_b
        wacc[start:end] += w_b

    wacc = np.maximum(wacc, 1e-8)
    return (acc / wacc).astype(np.float32)
