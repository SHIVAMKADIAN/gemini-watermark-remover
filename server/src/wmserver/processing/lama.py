"""LaMa (via IOPaint) image inpainting backend — adapter + contract.

IOPaint (formerly lama-cleaner, Apache-2.0) wraps LaMa and other models behind a
clean API. This adapter loads a model once and runs it per image. Requires
`wmserver[lama]` (torch + iopaint) and, ideally, a GPU. The `big-lama` weights
carry their own terms — verify before commercial use (see NOTICE).

When CUDA is requested but unavailable, we transparently fall back to CPU rather
than erroring, so the same image never fails just because there's no GPU.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np

from ..config import Settings
from .base import ImageInpainter

log = logging.getLogger("wmserver.lama")


def _resolve_device(requested: str) -> str:
    """Honour the requested device, but degrade cuda→cpu if torch can't see a GPU."""
    if requested.startswith("cuda"):
        try:
            import torch  # type: ignore

            if not torch.cuda.is_available():
                log.warning("cuda requested but unavailable; LaMa running on CPU.")
                return "cpu"
        except Exception:  # noqa: BLE001
            return "cpu"
    return requested


class LaMaInpainter(ImageInpainter):  # pragma: no cover - needs torch/iopaint
    name = "lama"

    def __init__(self, device: str = "cuda", settings: Optional[Settings] = None):
        settings = settings or Settings()
        try:
            from iopaint.model_manager import ModelManager  # type: ignore
        except Exception as exc:  # noqa: BLE001
            raise NotImplementedError(
                "LaMaInpainter needs IOPaint + torch (pip install 'wmserver[lama]'). "
                f"Falling back to the classical backend is automatic in the registry. ({exc})"
            )
        self._device = _resolve_device(device)
        self._hd_strategy = settings.lama_hd_strategy
        self._model = ModelManager(name=settings.lama_model, device=self._device)

    def _request(self):
        from iopaint.schema import InpaintRequest  # type: ignore

        try:
            from iopaint.schema import HDStrategy  # type: ignore

            return InpaintRequest(hd_strategy=HDStrategy(self._hd_strategy))
        except Exception:  # noqa: BLE001 — older/newer IOPaint schema; use defaults
            return InpaintRequest()

    def inpaint(self, image: np.ndarray, mask: np.ndarray) -> np.ndarray:
        rgb = image[..., :3]
        m = (mask.astype(np.uint8)) * 255
        # IOPaint takes/returns BGR ndarrays.
        result_bgr = self._model(rgb[..., ::-1], m, self._request())
        out = np.asarray(result_bgr)[..., ::-1]
        # Some IOPaint versions can return a resized canvas; guard the contract.
        if out.shape[:2] != image.shape[:2]:
            import cv2  # type: ignore

            out = cv2.resize(out, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_LANCZOS4)
        if image.ndim == 3 and image.shape[2] == 4:
            out = np.dstack([out.astype(np.uint8), image[..., 3]])
        return out.astype(np.uint8)
