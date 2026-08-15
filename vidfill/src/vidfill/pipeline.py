"""Stage orchestration.

Every stage is a pure `Sequence -> Sequence`. The classical pipeline wires the
implemented, GPU-free stages (homography flow → consistency → propagation →
composite) so easy footage (static/pan camera) produces real output today. The
full pipeline additionally inserts the learned stages (RAFT, flow completion,
synthesis) once their weights are wired.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .composite.blend import composite
from .flow.consistency import compute_validity
from .flow.homography import HomographyFlow
from .masking.refine import refine_masks
from .propagation.coverage import coverage_summary
from .propagation.recurrent import propagate
from .types import Sequence


@dataclass
class PipelineConfig:
    max_hops: int = 50
    feather_radius: int = 3
    dilate_radius: int = 6
    # Temporal-median mask cleanup is OFF by default: a per-pixel median over
    # time erodes legitimately moving masks (the common object-removal case). Set
    # >1 only for a jittery/near-static mask with single-frame dropouts.
    median_window: int = 1


def run_classical(seq: Sequence, config: PipelineConfig | None = None) -> tuple[Sequence, dict]:
    """Runs the implemented classical spine and returns (output, report).

    Requires `seq.masks`. Uses the homography/translation fast path for flow (no
    RAFT), retrieval-based propagation, and feathered compositing. Residual holes
    (never revealed) are left to the original pixels — plug a Synthesizer to fill
    them. `report` carries the coverage summary (the key diagnostic).
    """
    cfg = config or PipelineConfig()
    if seq.masks is None:
        raise ValueError("run_classical requires seq.masks (user-drawn removal region)")

    seq.validate()
    originals = seq.frames.copy()

    refined = refine_masks(seq.masks, cfg.dilate_radius, cfg.median_window)
    work = seq.with_(masks=refined)

    work = HomographyFlow().estimate(work)
    work = compute_validity(work)
    work = propagate(work, max_hops=cfg.max_hops)

    # Composite the filled frames back over the originals (feathered edge; only
    # the mask region changes, untouched pixels stay byte-identical).
    out_frames = np.empty_like(originals)
    for t in range(work.num_frames):
        out_frames[t] = composite(originals[t], work.frames[t], refined[t], cfg.feather_radius)

    out = work.with_(frames=out_frames)
    report = coverage_summary(work)
    return out, report


def selftest() -> dict:
    """Builds a synthetic clip (static background, moving occluder) and verifies
    the classical spine: the background is retrieved and untouched pixels are
    byte-identical. Returns a report dict; raises AssertionError on failure."""
    rng = np.random.default_rng(0)
    t, h, w = 9, 48, 64

    # Static, textured background (the ground truth behind the occluder).
    yy, xx = np.mgrid[0:h, 0:w]
    base = (0.4 * xx + 0.3 * yy) % 256
    noise = rng.integers(0, 40, size=(h, w))
    bg = np.clip(base + noise, 0, 255).astype(np.uint8)
    clean = np.repeat(bg[None, :, :, None], 3, axis=3).repeat(1, axis=0)
    clean = np.broadcast_to(clean, (t, h, w, 3)).copy()

    # A moving occluder square, corrupting the frames and defining the masks.
    frames = clean.copy()
    masks = np.zeros((t, h, w), dtype=bool)
    sq = 10
    for i in range(t):
        x0 = 4 + i * 5
        frames[i, 18 : 18 + sq, x0 : x0 + sq] = np.array([255, 0, 255], dtype=np.uint8)
        masks[i, 18 : 18 + sq, x0 : x0 + sq] = True

    seq = Sequence(frames=frames, masks=masks, fps=30.0)
    out, report = run_classical(seq, PipelineConfig(feather_radius=0, dilate_radius=0))

    # 1) The occluder is gone and the background is retrieved (not magenta).
    mid = t // 2
    region = masks[mid]
    err = np.abs(out.frames[mid].astype(int) - clean[mid].astype(int))[region].mean()
    assert err < 12, f"retrieved background error too high: {err:.1f}"

    # 2) Untouched pixels are byte-identical to the input.
    untouched = ~masks[mid]
    assert np.array_equal(out.frames[mid][untouched], frames[mid][untouched]), "untouched pixels changed"

    report["retrieval_mae"] = float(err)
    return report
