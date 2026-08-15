"""Feathered alpha compositing of the inpainted region into the original frame.

Never re-encode the whole frame — that degrades 99% of untouched pixels to fix
1%. We blend only inside a feathered mask edge; pixels outside the (dilated,
feathered) mask are byte-identical to the input. That invariant is the one users
notice immediately if it breaks, so it is asserted in `tests/test_composite.py`.
"""

from __future__ import annotations

import numpy as np


def _box_blur(a: np.ndarray, radius: int) -> np.ndarray:
    """Separable box blur via cumulative sums (NumPy-only, no SciPy/OpenCV)."""
    if radius <= 0:
        return a.astype(np.float32)
    out = a.astype(np.float32)
    for axis in (0, 1):
        n = out.shape[axis]
        cs = np.cumsum(out, axis=axis)
        cs = np.concatenate([np.zeros_like(np.take(cs, [0], axis=axis)), cs], axis=axis)
        idx = np.arange(n)
        lo = np.clip(idx - radius, 0, n)
        hi = np.clip(idx + radius + 1, 0, n)
        take_hi = np.take(cs, hi, axis=axis)
        take_lo = np.take(cs, lo, axis=axis)
        counts = (hi - lo).reshape([-1 if ax == axis else 1 for ax in range(out.ndim)])
        out = (take_hi - take_lo) / np.maximum(counts, 1)
    return out


def feather_alpha(mask: np.ndarray, feather_radius: int) -> np.ndarray:
    """Turns a boolean mask into a soft [0,1] alpha with a feathered edge."""
    a = mask.astype(np.float32)
    if feather_radius > 0:
        a = _box_blur(a, feather_radius)
        a = np.clip(a, 0.0, 1.0)
    return a


def composite(
    original: np.ndarray,
    filled: np.ndarray,
    mask: np.ndarray,
    feather_radius: int = 3,
) -> np.ndarray:
    """Alpha-blends `filled` into `original` over a feathered `mask`.

    Args:
        original: (H, W, 3) uint8 — untouched frame.
        filled:   (H, W, 3) uint8 — reconstructed frame (only mask region differs).
        mask:     (H, W) bool     — removal region.
    Returns:
        (H, W, 3) uint8. Pixels where the feathered alpha is exactly 0 equal
        `original` byte-for-byte.
    """
    alpha = feather_alpha(mask, feather_radius)[..., None]
    out = original.astype(np.float32) * (1.0 - alpha) + filled.astype(np.float32) * alpha
    out = np.clip(np.round(out), 0, 255).astype(np.uint8)
    # Hard-guarantee the untouched-pixel invariant against rounding drift.
    untouched = alpha[..., 0] == 0.0
    out[untouched] = original[untouched]
    return out
