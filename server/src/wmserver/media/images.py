"""Image decode/encode (Pillow). Preserves transparency; never resizes."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


def load_image(path: str | Path) -> np.ndarray:
    img = Image.open(path)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.mode else "RGB")
    return np.asarray(img)


def save_image(array: np.ndarray, path: str | Path) -> None:
    mode = "RGBA" if array.ndim == 3 and array.shape[2] == 4 else "RGB"
    Image.fromarray(array, mode=mode).save(path)
