"""Core data types passed between pipeline stages.

Every stage is a pure function `Sequence -> Sequence`. Arrays are NumPy so the
classical spine runs without torch; the learned stages may convert to tensors
internally and convert back.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Optional

import numpy as np


@dataclass
class Sequence:
    """A window (or whole clip) of frames plus every derived field.

    Fields are progressively populated as the sequence flows through stages;
    `None` means "not computed yet".

    Shapes (T frames, H high, W wide):
        frames:    (T, H, W, 3) uint8            — the RGB frames.
        masks:     (T, H, W)    bool             — True where content is removed.
        flow_fwd:  (T-1, H, W, 2) float32        — flow mapping frame t -> t+1.
        flow_bwd:  (T-1, H, W, 2) float32        — flow mapping frame t+1 -> t.
        validity:  (T-1, H, W)  bool             — fwd-bwd consistent pixels.
        coverage:  (T, H, W)    float32 in [0,1] — per-pixel fill confidence.
        fps:       float                          — frame rate (metadata only).
    """

    frames: np.ndarray
    masks: Optional[np.ndarray] = None
    flow_fwd: Optional[np.ndarray] = None
    flow_bwd: Optional[np.ndarray] = None
    validity: Optional[np.ndarray] = None
    coverage: Optional[np.ndarray] = None
    fps: float = 30.0

    # --- convenience -------------------------------------------------------

    @property
    def num_frames(self) -> int:
        return int(self.frames.shape[0])

    @property
    def height(self) -> int:
        return int(self.frames.shape[1])

    @property
    def width(self) -> int:
        return int(self.frames.shape[2])

    def with_(self, **changes) -> "Sequence":
        """Returns a shallow copy with the given fields replaced (stages stay pure)."""
        return replace(self, **changes)

    def validate(self) -> None:
        """Cheap shape/dtype assertions; call at stage boundaries in debug runs."""
        assert self.frames.ndim == 4 and self.frames.shape[-1] == 3, "frames must be (T,H,W,3)"
        assert self.frames.dtype == np.uint8, "frames must be uint8"
        t, h, w = self.num_frames, self.height, self.width
        if self.masks is not None:
            assert self.masks.shape == (t, h, w), "masks shape mismatch"
            assert self.masks.dtype == bool, "masks must be bool"
        for name, fl in (("flow_fwd", self.flow_fwd), ("flow_bwd", self.flow_bwd)):
            if fl is not None:
                assert fl.shape == (t - 1, h, w, 2), f"{name} must be (T-1,H,W,2)"
        if self.coverage is not None:
            assert self.coverage.shape == (t, h, w), "coverage shape mismatch"
