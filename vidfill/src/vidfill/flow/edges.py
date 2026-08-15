"""Flow-edge inpainting — interface + contract.

Complete the flow *edges* (discontinuities at depth boundaries) first, then use
them as a hard constraint when filling the flow field, so a smoothness-driven
fill does not bridge across a real boundary and drag propagated pixels over it.

The concrete model is a small edge-inpainting network; until trained, callers
can pass `edges=None` and the completion stage falls back to unconstrained
behavior (lower quality at boundaries).
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from ..types import Sequence


def gradient_edges(flow: np.ndarray, threshold: float = 1.0) -> np.ndarray:
    """Cheap edge map from flow gradient magnitude (a baseline / debug aid).

    Args:
        flow: (H, W, 2).
    Returns:
        (H, W) bool where the flow changes sharply.
    """
    gx = np.abs(np.diff(flow, axis=1, append=flow[:, -1:, :])).sum(axis=-1)
    gy = np.abs(np.diff(flow, axis=0, append=flow[-1:, :, :])).sum(axis=-1)
    return (gx + gy) > threshold


class FlowEdgeInpainter(ABC):
    """Completes flow-edge maps inside the mask."""

    @abstractmethod
    def inpaint_edges(self, seq: Sequence) -> np.ndarray:
        """Return a (T-1, H, W) bool completed edge map for the forward flow."""


class EdgeInpaintNet(FlowEdgeInpainter):  # pragma: no cover - stub
    """Learned edge-inpainting net. NOT IMPLEMENTED (train in-repo)."""

    def __init__(self, checkpoint: str | None = None):
        raise NotImplementedError("EdgeInpaintNet must be trained in-repo; see docs/build_order.md")

    def inpaint_edges(self, seq: Sequence) -> np.ndarray:
        raise NotImplementedError
