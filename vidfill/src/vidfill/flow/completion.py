"""Flow completion — re-infer flow inside the mask. Interface + contract.

Flow inside the mask describes the motion of the object being deleted, which
moves differently from the background behind it. Those vectors point somewhere
useless, and because propagation chains correspondences, one bad hop sends the
chain to the wrong place. This stage gates the quality of everything downstream.

Design constraints the concrete network MUST honor (see spec §4.3):

- Do NOT treat flow as a 2-channel image and inpaint with RGB machinery. Flow is
  *piecewise* smooth; complete the flow EDGES first (flow/edges.py) and fill the
  field with those edges as a hard constraint (FGVC-style, sharp at boundaries).
- Process bidirectionally with deformable alignment between adjacent flow fields
  so completion sees temporally aligned context.
- Losses, most-important-first: photometric warp loss (self-supervised) >
  L1-to-pseudo-GT (RAFT on clean video; bakes in RAFT errors, weight low) >
  edge-aware second-order smoothness (down-weighted at completed edges).
- Train on YouTube-VOS + DAVIS with BOTH free-form strokes and real object
  silhouettes (object-shaped mask statistics differ from random blobs).

Trained in-repo on permissive data (Apache-2.0 goal) — see
scripts/train_flow_completion.py.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..types import Sequence


class FlowCompletion(ABC):
    """Replaces flow inside the mask with a background-consistent estimate."""

    version: str = "abstract-0"

    @abstractmethod
    def complete(self, seq: Sequence) -> Sequence:
        """Return a copy of `seq` with in-mask flow re-inferred (edges-constrained)."""


class RecurrentFlowCompletion(FlowCompletion):  # pragma: no cover - stub
    """Edge-constrained recurrent completion net. NOT IMPLEMENTED (train in-repo)."""

    version = "vidfill-flowcomp-0.1"

    def __init__(self, checkpoint: str | None = None):
        raise NotImplementedError(
            "RecurrentFlowCompletion must be trained in-repo on permissive data "
            "(scripts/train_flow_completion.py). Use flow.homography.HomographyFlow's "
            "global model as the fast-path substitute for static/pan cameras."
        )

    def complete(self, seq: Sequence) -> Sequence:
        raise NotImplementedError
