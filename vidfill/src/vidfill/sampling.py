"""Vectorized bilinear sampling helpers (NumPy) shared across stages.

These are the browser-`grid_sample` equivalents the propagation and consistency
stages rely on. Kept dependency-free so the classical spine needs only NumPy.
"""

from __future__ import annotations

import numpy as np


def bilinear_sample(field: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Bilinearly sample `field` at float coordinates (x, y).

    Args:
        field: (H, W) or (H, W, C) array.
        x, y: arrays of identical shape holding sample coordinates.

    Returns:
        Sampled values with shape `x.shape` (+ trailing channel dim if `field`
        is 3-D). Coordinates are clamped to the valid range (edge padding).
    """
    h, w = field.shape[:2]
    x = np.clip(x, 0, w - 1)
    y = np.clip(y, 0, h - 1)
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)
    fx = (x - x0)[..., None] if field.ndim == 3 else (x - x0)
    fy = (y - y0)[..., None] if field.ndim == 3 else (y - y0)

    a = field[y0, x0]
    b = field[y0, x1]
    c = field[y1, x0]
    d = field[y1, x1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def coordinate_grid(h: int, w: int) -> tuple[np.ndarray, np.ndarray]:
    """Returns (xs, ys) integer coordinate grids of shape (H, W) as float32."""
    ys, xs = np.mgrid[0:h, 0:w]
    return xs.astype(np.float32), ys.astype(np.float32)
