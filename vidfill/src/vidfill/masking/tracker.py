"""Interactive mask tracking (SAM2) — interface + contract.

SAM2's memory bank handles occlusion and re-appearance better than XMem or
per-frame re-segmentation, and it gives the interactive correction loop for
free: the user scrubs to a frame where the mask drifted, adds a click, and it
re-propagates. Weights/inference need the `[models]` extra and a GPU, so the
concrete tracker raises until wired; `refine.py` (dilation/feather/temporal
median) is implemented and dependency-free.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import numpy as np


@dataclass
class Click:
    """A user annotation on a specific frame (foreground=+, background=-)."""

    frame: int
    x: int
    y: int
    positive: bool = True


@dataclass
class MaskSession:
    """Replayable annotation state: the click sequence plus cached masks."""

    clicks: list[Click] = field(default_factory=list)
    # masks are stored as RLE in session.py; kept dense here for convenience.
    masks: np.ndarray | None = None


class MaskTracker(ABC):
    """Turns a click sequence into per-frame masks, and re-propagates on edits."""

    @abstractmethod
    def add_click(self, click: Click) -> None:
        """Register a click and (re)propagate masks forward from its frame."""

    @abstractmethod
    def masks(self) -> np.ndarray:
        """Return the current (T, H, W) bool mask stack."""


class Sam2Tracker(MaskTracker):  # pragma: no cover - stub
    """SAM2-backed tracker. NOT IMPLEMENTED — install vidfill[models] and wire weights."""

    def __init__(self, frames: np.ndarray, checkpoint: str | None = None):
        raise NotImplementedError(
            "Sam2Tracker requires the SAM2 checkpoint and torch (vidfill[models]). "
            "See scripts/fetch_weights.py. The mask-refinement ops in masking/refine.py "
            "and the rest of the pipeline work on any (T,H,W) bool mask you supply."
        )

    def add_click(self, click: Click) -> None:
        raise NotImplementedError

    def masks(self) -> np.ndarray:
        raise NotImplementedError
