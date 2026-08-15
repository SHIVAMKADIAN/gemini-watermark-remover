"""Bidirectional chained propagation with sample-once retrieval.

**The chained-resampling trap.** Warping frame t-1 into t, filling, warping that
into t+1, and so on is wrong: every warp is a bilinear (low-pass) resample, and
fifty of them leave the fill visibly softer than its surroundings, while flow
error accumulates with nothing to correct it.

**So we use the flow chain only to compute correspondence, then sample once.**
For each masked pixel we chain displacement vectors to find where it lands many
frames away, then take a single bilinear sample from the *original, untouched*
frame there. One resample regardless of chain length.

The chain runs in both directions; the nearer valid candidate wins (error
compounds with hops). This module is pure NumPy and unit-tested
(`tests/test_propagation.py`).
"""

from __future__ import annotations

import numpy as np

from ..sampling import bilinear_sample, coordinate_grid
from ..types import Sequence


def _chase(
    frames: np.ndarray,
    masks: np.ndarray,
    flow: np.ndarray,  # per-hop flow mapping cur -> next along this direction
    validity: np.ndarray,  # per-hop validity for the same pairs
    t: int,
    direction: int,  # +1 or -1
    max_hops: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Chase every pixel of frame t along one temporal direction.

    Returns (candidate RGB (H,W,3) float32, distance (H,W) int, found (H,W) bool).
    """
    n, h, w = masks.shape
    xs, ys = coordinate_grid(h, w)
    posx, posy = xs.copy(), ys.copy()
    alive = masks[t].copy()  # only masked pixels need a source
    found = np.zeros((h, w), dtype=bool)
    dist = np.zeros((h, w), dtype=np.int32)
    cand = np.zeros((h, w, 3), dtype=np.float32)

    cur = t
    for hop in range(1, max_hops + 1):
        nxt = cur + direction
        if nxt < 0 or nxt >= n:
            break
        pair = cur if direction > 0 else nxt  # flow/validity index for this hop
        prevx, prevy = posx.copy(), posy.copy()

        f = bilinear_sample(flow[pair], prevx, prevy)  # (H,W,2)
        posx = prevx + f[..., 0]
        posy = prevy + f[..., 1]

        v = bilinear_sample(validity[pair].astype(np.float32), prevx, prevy) > 0.5
        in_bounds = (posx >= 0) & (posx <= w - 1) & (posy >= 0) & (posy <= h - 1)
        alive &= v & in_bounds

        landed_masked = bilinear_sample(masks[nxt].astype(np.float32), posx, posy) > 0.5
        newly = alive & (~found) & (~landed_masked)
        if newly.any():
            sampled = bilinear_sample(frames[nxt].astype(np.float32), posx, posy)
            cand[newly] = sampled[newly]
            dist[newly] = hop
            found |= newly

        cur = nxt
    return cand, dist, found


def propagate(seq: Sequence, max_hops: int = 50) -> Sequence:
    """Fills masked pixels with real pixels retrieved from other frames.

    Requires `masks`, `flow_fwd`, `flow_bwd`, and `validity`. Fills only masked
    pixels that a chain reaches an unmasked, consistent source for; sets
    `coverage` to 1 there and leaves the rest at 0 (routed to synthesis). Frames
    outside the mask are untouched.
    """
    if seq.masks is None or seq.flow_fwd is None or seq.flow_bwd is None or seq.validity is None:
        raise ValueError("propagate requires masks, flow_fwd, flow_bwd, validity")

    frames = seq.frames.copy()
    masks = seq.masks
    n, h, w = masks.shape
    coverage = np.zeros((n, h, w), dtype=np.float32)

    for t in range(n):
        if not masks[t].any():
            continue
        cf, df, ff = _chase(frames, masks, seq.flow_fwd, seq.validity, t, +1, max_hops)
        cb, db, fb = _chase(frames, masks, seq.flow_bwd, seq.validity, t, -1, max_hops)

        # Bidirectional merge: nearer valid candidate wins (do NOT average —
        # averaging two disagreeing candidates produces a ghost).
        use_fwd = ff & (~fb | (df <= db))
        use_bwd = fb & (~ff | (db < df))

        out = frames[t].astype(np.float32)
        out[use_fwd] = cf[use_fwd]
        out[use_bwd] = cb[use_bwd]
        frames[t] = np.clip(np.round(out), 0, 255).astype(np.uint8)
        coverage[t] = (use_fwd | use_bwd).astype(np.float32)

    return seq.with_(frames=frames, coverage=coverage)
