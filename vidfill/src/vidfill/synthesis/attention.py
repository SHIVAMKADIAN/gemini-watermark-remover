"""Generative synthesis for residual holes — interface + contract.

Runs ONLY for pixels the coverage map reports unfilled (never revealed in any
frame). A transformer with sparse spatiotemporal attention over a sliding window
plus a few strided reference frames. **Restrict attention to masked query
positions only** — dense attention over all tokens is where memory blows up and
buys almost nothing.

Two hard cases the concrete model should detect and surface, not silently mush:
- Static camera + static occluder: nothing is ever revealed; generate once on a
  keyframe and propagate that synthetic result forward (see keyframe.py). Quality
  ceiling is much lower — tell the user.
- Stochastic backgrounds (water, foliage, crowds, fire): high-entropy true flow;
  completion regresses to the smooth mean so propagated pixels look frozen.
  Detect via high flow variance in the surrounding ring and route here.

Trained in-repo on permissive data (Apache-2.0 goal). M1 may use LaMa per-frame
behind this interface, flagged non-permissive in NOTICE until replaced.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..types import Sequence


class Synthesizer(ABC):
    """Fills residual (never-revealed) holes with generated content."""

    version: str = "abstract-0"

    @abstractmethod
    def synthesize(self, seq: Sequence) -> Sequence:
        """Fill pixels where coverage < 0.5 & mask; return updated Sequence."""


class SparseAttentionSynthesizer(Synthesizer):  # pragma: no cover - stub
    """Sparse spatiotemporal transformer. NOT IMPLEMENTED (train in-repo)."""

    version = "vidfill-synth-0.1"

    def __init__(self, checkpoint: str | None = None, window: int = 20):
        raise NotImplementedError(
            "SparseAttentionSynthesizer must be trained in-repo on permissive data. "
            "M1 may substitute a per-frame LaMa behind this interface (flag in NOTICE)."
        )

    def synthesize(self, seq: Sequence) -> Sequence:
        raise NotImplementedError
