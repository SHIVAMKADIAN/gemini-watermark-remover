"""VFID (Video Fréchet Inception Distance) — perceptual quality metric.

Requires a pretrained video feature extractor (torch), so it lives behind the
`[models]` extra and raises until wired. Warping error (warp_error.py) is the
CPU-only primary metric used by the test suite and `benchmark.py`.
"""

from __future__ import annotations

import numpy as np


def vfid(real: np.ndarray, generated: np.ndarray) -> float:  # pragma: no cover - stub
    """Compute VFID between two clips. NOT IMPLEMENTED (needs a torch I3D backbone).

    Intended contract: lower is better; symmetric-ish; operates on (T,H,W,3) uint8.
    """
    raise NotImplementedError(
        "VFID needs a pretrained I3D/ResNet3D feature extractor (install vidfill[models]). "
        "Use metrics.warp_error for a dependency-free flicker metric."
    )
