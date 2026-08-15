"""Forward-backward flow consistency → per-pixel validity mask.

This is the safety rail of the whole pipeline. Without it, propagation silently
pulls in wrong pixels and produces artifacts that look like model failure but
are flow failure. Pixels that fail the check are marked invalid, excluded from
propagation, and routed to synthesis.

Fully implemented and unit-tested (`tests/test_consistency.py`).
"""

from __future__ import annotations

import numpy as np

from ..sampling import bilinear_sample, coordinate_grid
from ..types import Sequence


def forward_backward_validity(
    flow_fwd: np.ndarray,
    flow_bwd: np.ndarray,
    alpha: float = 0.01,
    beta: float = 0.5,
) -> np.ndarray:
    """Validity mask for a single frame pair.

    For each pixel x with forward flow F_fwd(x), let x' = x + F_fwd(x). The pixel
    is consistent when the round trip returns near the origin:

        residual = F_fwd(x) + F_bwd(x')
        |residual|^2 < alpha * (|F_fwd|^2 + |F_bwd(x')|^2) + beta

    The threshold is *adaptive* (scales with flow magnitude) because fast motion
    legitimately has larger flow error; a fixed pixel count would reject it.
    Pixels whose forward mapping leaves the frame are invalid.

    Args:
        flow_fwd: (H, W, 2) flow mapping this frame -> next.
        flow_bwd: (H, W, 2) flow mapping next frame -> this.
    Returns:
        (H, W) bool validity mask.
    """
    h, w = flow_fwd.shape[:2]
    xs, ys = coordinate_grid(h, w)
    fx, fy = flow_fwd[..., 0], flow_fwd[..., 1]
    x2 = xs + fx
    y2 = ys + fy

    bwd_at = bilinear_sample(flow_bwd, x2, y2)  # (H, W, 2)
    bx, by = bwd_at[..., 0], bwd_at[..., 1]

    rx = fx + bx
    ry = fy + by
    residual_sq = rx * rx + ry * ry
    thresh = alpha * (fx * fx + fy * fy + bx * bx + by * by) + beta

    valid = residual_sq < thresh
    in_bounds = (x2 >= 0) & (x2 <= w - 1) & (y2 >= 0) & (y2 <= h - 1)
    return valid & in_bounds


def compute_validity(seq: Sequence, alpha: float = 0.01, beta: float = 0.5) -> Sequence:
    """Stage: fills `seq.validity` (T-1, H, W) from `flow_fwd`/`flow_bwd`."""
    if seq.flow_fwd is None or seq.flow_bwd is None:
        raise ValueError("compute_validity requires flow_fwd and flow_bwd")
    pairs = seq.flow_fwd.shape[0]
    validity = np.empty((pairs, seq.height, seq.width), dtype=bool)
    for i in range(pairs):
        validity[i] = forward_backward_validity(seq.flow_fwd[i], seq.flow_bwd[i], alpha, beta)
    return seq.with_(validity=validity)
