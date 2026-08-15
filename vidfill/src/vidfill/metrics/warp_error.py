"""Warping error — the primary flicker metric.

Per-frame PSNR is close to useless for inpainting quality. Instead, warp frame t
to t+1 with (ground-truth) flow and measure the discrepancy in the inpainted
region: temporally consistent fills warp cleanly onto the next frame, flickering
ones do not.
"""

from __future__ import annotations

import numpy as np

from ..sampling import bilinear_sample, coordinate_grid


def warp_error(
    frame_t: np.ndarray,
    frame_t1: np.ndarray,
    flow_fwd: np.ndarray,
    region: np.ndarray | None = None,
) -> float:
    """Mean L1 between frame_{t+1} and frame_t warped forward by `flow_fwd`.

    Args:
        frame_t, frame_t1: (H, W, 3) uint8.
        flow_fwd: (H, W, 2) flow mapping t -> t+1.
        region: optional (H, W) bool; restrict the metric to these pixels
            (e.g. the inpainted region).
    Returns:
        Mean absolute error in [0, 255].
    """
    h, w = frame_t.shape[:2]
    xs, ys = coordinate_grid(h, w)
    warped = bilinear_sample(frame_t.astype(np.float32), xs + flow_fwd[..., 0], ys + flow_fwd[..., 1])
    diff = np.abs(warped - frame_t1.astype(np.float32)).mean(axis=-1)
    if region is not None:
        sel = region.astype(bool)
        if not sel.any():
            return 0.0
        return float(diff[sel].mean())
    return float(diff.mean())
