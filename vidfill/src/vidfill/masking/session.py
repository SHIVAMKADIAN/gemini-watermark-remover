"""Mask session (de)serialization: RLE masks + replayable click sequence.

Storing the click sequence separately lets corrections be replayed without
re-running from scratch. RLE keeps mask storage compact.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

import numpy as np

from .tracker import Click, MaskSession


def rle_encode(mask: np.ndarray) -> dict:
    """Column-major RLE of a single (H, W) bool mask (COCO-style counts)."""
    h, w = mask.shape
    flat = np.asfortranarray(mask).astype(np.uint8).ravel(order="F")
    counts: list[int] = []
    prev = 0  # RLE starts by counting zeros
    run = 0
    for v in flat:
        if v == prev:
            run += 1
        else:
            counts.append(run)
            run = 1
            prev = v
    counts.append(run)
    return {"size": [h, w], "counts": counts}


def rle_decode(rle: dict) -> np.ndarray:
    """Inverse of :func:`rle_encode`."""
    h, w = rle["size"]
    flat = np.zeros(h * w, dtype=np.uint8)
    idx = 0
    val = 0
    for run in rle["counts"]:
        if val == 1:
            flat[idx : idx + run] = 1
        idx += run
        val ^= 1
    return np.asfortranarray(flat.reshape((h, w), order="F")).astype(bool)


def save_session(session: MaskSession, path: str | Path) -> None:
    data = {
        "clicks": [asdict(c) for c in session.clicks],
        "masks": [rle_encode(session.masks[i]) for i in range(session.masks.shape[0])]
        if session.masks is not None
        else None,
    }
    Path(path).write_text(json.dumps(data))


def load_session(path: str | Path) -> MaskSession:
    data = json.loads(Path(path).read_text())
    clicks = [Click(**c) for c in data.get("clicks", [])]
    masks = None
    if data.get("masks"):
        masks = np.stack([rle_decode(r) for r in data["masks"]], axis=0)
    return MaskSession(clicks=clicks, masks=masks)
