"""Static-scene fallback: generate once, propagate the synthetic result.

When nothing is ever revealed (static camera + static occluder), consistency has
to come from generating on a keyframe and propagating that synthetic result
forward as if it were real, rather than generating independently per frame.

The *propagation* half is the real, implemented one (propagation.recurrent); the
per-keyframe *generation* is the Synthesizer stub. This module wires the two once
a Synthesizer exists.
"""

from __future__ import annotations

from ..types import Sequence
from .attention import Synthesizer


def keyframe_fill(seq: Sequence, synthesizer: Synthesizer, keyframe: int = 0) -> Sequence:  # pragma: no cover
    """Generate the hole on `keyframe`, then propagate it to the rest as if real."""
    raise NotImplementedError(
        "keyframe_fill needs a concrete Synthesizer (synthesis.attention). The propagation "
        "half is available via propagation.recurrent.propagate once a synthetic keyframe exists."
    )
