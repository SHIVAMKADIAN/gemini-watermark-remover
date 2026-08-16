"""ProPainter video inpainting backend — adapter + contract.

ProPainter (sczhou/ProPainter) is a strong flow-guided video inpainter. NOTE its
license is **S-Lab Non-Commercial** — fine for personal/research use, not for
commercial deployment (see NOTICE). Requires `wmserver[propainter]` (torch +
torchvision) and a GPU with enough VRAM for the chosen window.

This adapter runs ProPainter over a window of frames + masks and returns the
filled frames. Until wired, the registry falls back to the classical vidfill
backend.
"""

from __future__ import annotations

from typing import Optional

import numpy as np

from .base import ProgressCb, VideoInpainter, VideoResult


class ProPainterInpainter(VideoInpainter):  # pragma: no cover - needs torch + weights
    name = "propainter"

    def __init__(self, device: str = "cuda", neighbor_length: int = 10, ref_stride: int = 10):
        raise NotImplementedError(
            "ProPainterInpainter needs torch + ProPainter weights (pip install "
            "'wmserver[propainter]'; fetch weights per upstream). It is S-Lab "
            "NON-COMMERCIAL — see NOTICE. The classical vidfill backend is the "
            "permissive, always-available fallback."
        )

    def inpaint(
        self,
        frames: np.ndarray,
        masks: np.ndarray,
        progress: Optional[ProgressCb] = None,
    ) -> VideoResult:
        raise NotImplementedError
