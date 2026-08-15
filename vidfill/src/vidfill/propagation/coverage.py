"""Per-pixel fill coverage — the primary diagnostic.

Coverage routes the residual to synthesis and is the first number to look at
when output is bad: coverage at 20% on footage you expected to be easy means
flow completion is broken, not synthesis.
"""

from __future__ import annotations

import numpy as np

from ..types import Sequence


def residual_mask(seq: Sequence, threshold: float = 0.5) -> np.ndarray:
    """(T, H, W) bool: masked pixels that propagation did NOT fill (need synthesis)."""
    if seq.masks is None:
        raise ValueError("residual_mask requires masks")
    cov = seq.coverage if seq.coverage is not None else np.zeros_like(seq.masks, dtype=np.float32)
    return seq.masks & (cov < threshold)


def coverage_summary(seq: Sequence) -> dict[str, float]:
    """Aggregate coverage stats for logging / the CLI report."""
    if seq.masks is None:
        return {"masked_pixels": 0.0, "coverage": 1.0}
    masked = seq.masks.sum(dtype=np.int64)
    if masked == 0:
        return {"masked_pixels": 0.0, "coverage": 1.0}
    cov = seq.coverage if seq.coverage is not None else np.zeros_like(seq.masks, dtype=np.float32)
    filled = float((seq.masks & (cov >= 0.5)).sum(dtype=np.int64))
    return {"masked_pixels": float(masked), "coverage": filled / float(masked)}
