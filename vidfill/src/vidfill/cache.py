"""Content-hashed cache for expensive stage outputs (flow dominates runtime).

Keyed on a hash of (frame bytes, model version, params) so masks can be iterated
without recomputing flow — the difference between a tolerable and intolerable UX.
Small, dependency-free, on-disk `.npz` store.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Optional

import numpy as np


def content_key(frames: np.ndarray, model_version: str, params: Optional[dict] = None) -> str:
    """Stable hash of the inputs that determine a cached artifact."""
    h = hashlib.sha256()
    h.update(np.ascontiguousarray(frames).tobytes())
    h.update(model_version.encode("utf-8"))
    h.update(json.dumps(params or {}, sort_keys=True).encode("utf-8"))
    return h.hexdigest()[:32]


class FlowCache:
    """Tiny on-disk cache of NumPy arrays keyed by `content_key`."""

    def __init__(self, root: str | Path = ".vidfill_cache"):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self.root / f"{key}.npz"

    def get(self, key: str) -> Optional[dict[str, np.ndarray]]:
        path = self._path(key)
        if not path.exists():
            return None
        with np.load(path) as data:
            return {k: data[k] for k in data.files}

    def put(self, key: str, **arrays: np.ndarray) -> None:
        np.savez_compressed(self._path(key), **arrays)
