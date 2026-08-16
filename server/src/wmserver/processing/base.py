"""Inpainting backend interfaces.

Backends operate on NumPy arrays so the queue/worker never touch model specifics.
File <-> array conversion (and audio passthrough) is the media layer's job.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Callable, Optional

import numpy as np

ProgressCb = Callable[[float, str], None]


class ImageInpainter(ABC):
    name: str = "abstract"

    @abstractmethod
    def inpaint(self, image: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """image (H,W,3|4) uint8, mask (H,W) bool (True=remove) → inpainted image."""


class VideoResult:
    def __init__(self, frames: np.ndarray, coverage: Optional[float]):
        self.frames = frames
        self.coverage = coverage


class VideoInpainter(ABC):
    name: str = "abstract"

    @abstractmethod
    def inpaint(
        self,
        frames: np.ndarray,
        masks: np.ndarray,
        progress: Optional[ProgressCb] = None,
    ) -> VideoResult:
        """frames (T,H,W,3) uint8, masks (T,H,W) bool → filled frames + coverage."""
