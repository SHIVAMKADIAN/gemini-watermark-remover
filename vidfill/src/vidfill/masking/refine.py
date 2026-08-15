"""Mask post-processing: dilation, feather, temporal median. Implemented (NumPy).

- Dilate 5–10px: quality falls off badly if edge pixels of the removed object
  survive at the boundary and contaminate the fill.
- Temporal median over a small window suppresses single-frame mask dropouts.
"""

from __future__ import annotations

import numpy as np


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    """Binary dilation of a (H, W) or (T, H, W) mask by a square structuring
    element of the given radius (max filter via separable cumulative counts)."""
    if radius <= 0:
        return mask.astype(bool)
    a = mask.astype(np.float32)
    single = a.ndim == 2
    if single:
        a = a[None]
    t, h, w = a.shape
    # Separable max via sliding window using stride tricks would be ideal; a
    # simple, correct shift-accumulate is fine for typical radii (<=10).
    out = a.copy()
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            shifted = np.zeros_like(a)
            ys0, ys1 = max(0, dy), min(h, h + dy)
            xs0, xs1 = max(0, dx), min(w, w + dx)
            shifted[:, ys0:ys1, xs0:xs1] = a[:, max(0, -dy) : h - max(0, dy) if dy > 0 else h,
                                             max(0, -dx) : w - max(0, dx) if dx > 0 else w]
            out = np.maximum(out, shifted)
    result = out > 0.5
    return result[0] if single else result


def temporal_median(masks: np.ndarray, window: int = 5) -> np.ndarray:
    """Median-filter a (T, H, W) bool mask stack along time to drop single-frame
    dropouts. `window` should be odd."""
    if masks.ndim != 3:
        raise ValueError("temporal_median expects (T, H, W)")
    if window <= 1:
        return masks.astype(bool)
    half = window // 2
    t = masks.shape[0]
    a = masks.astype(np.float32)
    out = np.empty_like(a)
    for i in range(t):
        lo, hi = max(0, i - half), min(t, i + half + 1)
        out[i] = np.median(a[lo:hi], axis=0)
    return out > 0.5


def refine_masks(masks: np.ndarray, dilate_radius: int = 6, median_window: int = 5) -> np.ndarray:
    """Full refinement: temporal median then spatial dilation."""
    m = temporal_median(masks, median_window)
    return dilate(m, dilate_radius)
