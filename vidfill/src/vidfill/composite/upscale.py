"""Masked-region residual upsampling.

Inference runs at 432p/512p; only the inpainted region is upsampled back to full
resolution and blended in (see composite/blend.py). This keeps the 99% of
untouched pixels at native quality. Bilinear resize is implemented with the
shared NumPy sampler so the classical spine needs no OpenCV.
"""

from __future__ import annotations

import numpy as np

from ..sampling import bilinear_sample


def resize_bilinear(image: np.ndarray, out_h: int, out_w: int) -> np.ndarray:
    """Bilinearly resize an (H, W, C) image to (out_h, out_w, C)."""
    h, w = image.shape[:2]
    ys = (np.arange(out_h) + 0.5) * (h / out_h) - 0.5
    xs = (np.arange(out_w) + 0.5) * (w / out_w) - 0.5
    gx, gy = np.meshgrid(xs, ys)
    sampled = bilinear_sample(image.astype(np.float32), gx, gy)
    if image.dtype == np.uint8:
        return np.clip(np.round(sampled), 0, 255).astype(np.uint8)
    return sampled.astype(image.dtype)
