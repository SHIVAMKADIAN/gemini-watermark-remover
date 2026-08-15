"""Video encode with audio + metadata passthrough (PyAV) — interface + contract.

Never re-encode the whole frame to fix 1% of pixels: the caller composites only
the masked region back into the original decoded frame (composite/blend.py), and
this writer muxes the result while copying the source audio stream and container
metadata unchanged.
"""

from __future__ import annotations

import numpy as np

try:
    import av  # type: ignore

    _HAVE_AV = True
except Exception:  # pragma: no cover
    _HAVE_AV = False


def write_video(  # pragma: no cover - needs PyAV
    path: str,
    frames: np.ndarray,
    fps: float,
    audio_source: str | None = None,
) -> None:
    """Encode `frames` (T,H,W,3 uint8) to `path`, copying audio from
    `audio_source` (usually the input file) without re-encoding. Requires PyAV."""
    if not _HAVE_AV:
        raise NotImplementedError("write_video needs PyAV (pip install 'vidfill[io]').")
    _ = (path, frames, fps, audio_source)
    raise NotImplementedError(
        "write_video: implement PyAV mux — encode video track, remux the source "
        "audio packets unchanged, copy container metadata."
    )
