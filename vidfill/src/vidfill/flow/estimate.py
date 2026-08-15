"""Optical flow estimation (RAFT) — interface + contract.

RAFT, both directions, between adjacent frames, computed at 1/4 resolution and
upsampled. Two things to get right (documented here so the concrete impl honors
them):

1. Scale the flow *values* by the same factor as the grid on upsample.
2. Use RAFT's convex (learned 3x3) upsampling or joint bilateral upsampling
   guided by the RGB frame — plain bilinear blurs the discontinuities that flow
   completion depends on.

Cache results keyed on (frame bytes, model version) — flow dominates runtime.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from ..types import Sequence


class FlowEstimator(ABC):
    """Produces forward and backward flow for adjacent frame pairs."""

    version: str = "abstract-0"

    @abstractmethod
    def estimate(self, seq: Sequence) -> Sequence:
        """Return a copy of `seq` with `flow_fwd`/`flow_bwd` (T-1,H,W,2) filled."""


class RaftFlow(FlowEstimator):  # pragma: no cover - stub
    """RAFT-backed estimator. NOT IMPLEMENTED — install vidfill[models]."""

    version = "raft-things-1.0"

    def __init__(self, iters: int = 20, scale: float = 0.25):
        raise NotImplementedError(
            "RaftFlow needs torch + RAFT weights (vidfill[models]; see scripts/fetch_weights.py). "
            "For the classical fast path use flow.homography.HomographyFlow, or supply your own "
            "flow arrays on the Sequence."
        )

    def estimate(self, seq: Sequence) -> Sequence:
        raise NotImplementedError
