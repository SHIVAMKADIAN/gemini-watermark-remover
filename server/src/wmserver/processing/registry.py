"""Backend selection with graceful fallback.

`auto` prefers the GPU model and falls back to the classical CPU backend when the
model extra isn't installed or fails to initialize — so a box without a GPU still
serves requests (at classical quality) instead of erroring.
"""

from __future__ import annotations

import logging
from typing import Optional

from ..config import Settings
from .base import ImageInpainter, VideoInpainter
from .classical import ClassicalImageInpainter, ClassicalVideoInpainter

log = logging.getLogger("wmserver.registry")


def select_image_backend(name: str, settings: Optional[Settings] = None) -> ImageInpainter:
    settings = settings or Settings()
    device = settings.device
    name = (name or "auto").lower()
    if name in ("classical", "classical-cv"):
        return ClassicalImageInpainter()
    if name in ("auto", "lama"):
        try:
            from .lama import LaMaInpainter

            return LaMaInpainter(device=device, settings=settings)
        except Exception as exc:  # NotImplementedError when extra missing
            if name == "lama":
                raise
            log.info("LaMa unavailable (%s); using classical image backend.", exc)
            return ClassicalImageInpainter()
    raise ValueError(f"unknown image backend: {name!r}")


def select_video_backend(name: str, settings: Optional[Settings] = None) -> VideoInpainter:
    settings = settings or Settings()
    device = settings.device
    name = (name or "auto").lower()
    if name in ("classical", "classical-vidfill"):
        return ClassicalVideoInpainter()
    if name in ("auto", "propainter"):
        try:
            from .propainter import ProPainterInpainter

            return ProPainterInpainter(device=device, settings=settings)
        except Exception as exc:
            if name == "propainter":
                raise
            log.info("ProPainter unavailable (%s); using classical video backend.", exc)
            return ClassicalVideoInpainter()
    raise ValueError(f"unknown video backend: {name!r}")
