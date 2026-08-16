"""LaMa (via IOPaint) image inpainting backend — adapter + contract.

IOPaint (formerly lama-cleaner, Apache-2.0) wraps LaMa and other models behind a
clean API. This adapter loads a LaMa model once and runs it per image. Requires
`wmserver[lama]` (torch + iopaint) and, ideally, a GPU. The `big-lama` weights
carry their own terms — verify before commercial use (see NOTICE).
"""

from __future__ import annotations

import numpy as np

from .base import ImageInpainter


class LaMaInpainter(ImageInpainter):  # pragma: no cover - needs torch/iopaint
    name = "lama"

    def __init__(self, model: str = "lama", device: str = "cuda"):
        try:
            from iopaint.model_manager import ModelManager  # type: ignore
        except Exception as exc:  # noqa: BLE001
            raise NotImplementedError(
                "LaMaInpainter needs IOPaint + torch (pip install 'wmserver[lama]'). "
                f"Falling back to the classical backend is automatic in the registry. ({exc})"
            )
        self._model = ModelManager(name=model, device=device)
        self._device = device

    def inpaint(self, image: np.ndarray, mask: np.ndarray) -> np.ndarray:
        from iopaint.schema import InpaintRequest  # type: ignore

        rgb = image[..., :3]
        m = (mask.astype(np.uint8)) * 255
        # IOPaint returns a BGR ndarray; convert back to RGB.
        result_bgr = self._model(rgb[..., ::-1], m, InpaintRequest())
        out = result_bgr[..., ::-1]
        if image.ndim == 3 and image.shape[2] == 4:
            out = np.dstack([out, image[..., 3]])
        return out
