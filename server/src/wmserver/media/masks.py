"""Build removal masks from a fractional region (resolution-independent)."""

from __future__ import annotations

import numpy as np

from ..models import Region


def region_to_mask(region: Region, height: int, width: int) -> np.ndarray:
    """Rasterize a fractional rectangle to a (H, W) bool mask."""
    x0 = int(round(region.x * width))
    y0 = int(round(region.y * height))
    x1 = min(width, int(round((region.x + region.w) * width)))
    y1 = min(height, int(round((region.y + region.h) * height)))
    mask = np.zeros((height, width), dtype=bool)
    mask[max(0, y0):y1, max(0, x0):x1] = True
    return mask


def region_to_mask_stack(region: Region, frames: int, height: int, width: int) -> np.ndarray:
    """(T, H, W) bool: the same static region on every frame (a fixed watermark/
    object). For a moving object, supply per-frame masks from a tracker instead."""
    single = region_to_mask(region, height, width)
    return np.broadcast_to(single, (frames, height, width)).copy()
