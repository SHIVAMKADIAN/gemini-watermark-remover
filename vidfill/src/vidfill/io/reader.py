"""Streaming video decode (PyAV) — interface + contract.

Streams frames as (H, W, 3) uint8 without loading the whole clip into memory.
Concrete impl needs PyAV (`vidfill[io]`); a helper to wrap an in-memory frame
array as a Sequence is provided for tests/selftest.
"""

from __future__ import annotations

from typing import Iterator

import numpy as np

from ..types import Sequence

try:
    import av  # type: ignore

    _HAVE_AV = True
except Exception:  # pragma: no cover
    _HAVE_AV = False


def read_frames(path: str) -> Iterator[np.ndarray]:  # pragma: no cover - needs PyAV
    """Yield RGB frames from a media file. Requires vidfill[io]."""
    if not _HAVE_AV:
        raise NotImplementedError("read_frames needs PyAV (pip install 'vidfill[io]').")
    container = av.open(path)
    for frame in container.decode(video=0):
        yield frame.to_ndarray(format="rgb24")


def sequence_from_array(frames: np.ndarray, fps: float = 30.0) -> Sequence:
    """Wrap a (T, H, W, 3) uint8 array as a Sequence (used by tests/selftest)."""
    seq = Sequence(frames=frames.astype(np.uint8), fps=fps)
    seq.validate()
    return seq
