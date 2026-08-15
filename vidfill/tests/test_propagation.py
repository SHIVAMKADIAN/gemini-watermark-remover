import numpy as np

from vidfill.flow.consistency import compute_validity
from vidfill.propagation.coverage import coverage_summary, residual_mask
from vidfill.propagation.recurrent import propagate
from vidfill.types import Sequence


def _moving_occluder_sequence():
    """Static textured background with a square occluder sliding across it."""
    rng = np.random.default_rng(3)
    t, h, w = 9, 48, 64
    yy, xx = np.mgrid[0:h, 0:w]
    bg = np.clip((0.5 * xx + 0.4 * yy) % 256 + rng.integers(0, 30, (h, w)), 0, 255).astype(np.uint8)
    clean = np.broadcast_to(bg[None, :, :, None], (t, h, w, 3)).copy()

    frames = clean.copy()
    masks = np.zeros((t, h, w), dtype=bool)
    sq = 10
    for i in range(t):
        x0 = 3 + i * 5
        frames[i, 18 : 18 + sq, x0 : x0 + sq] = np.array([255, 0, 255], dtype=np.uint8)
        masks[i, 18 : 18 + sq, x0 : x0 + sq] = True

    # Static camera → zero flow everywhere; consistency is computed from it.
    zeros = np.zeros((t - 1, h, w, 2), dtype=np.float32)
    seq = Sequence(frames=frames, masks=masks, flow_fwd=zeros, flow_bwd=zeros.copy())
    seq = compute_validity(seq)
    return seq, clean


def test_propagation_retrieves_true_background():
    seq, clean = _moving_occluder_sequence()
    out = propagate(seq, max_hops=20)

    mid = seq.num_frames // 2
    region = seq.masks[mid]
    # Retrieved pixels should match the real (static) background, not the magenta
    # occluder — this is retrieval, not generation.
    err = np.abs(out.frames[mid].astype(int) - clean[mid].astype(int))[region].mean()
    assert err < 8, f"retrieval error too high: {err:.2f}"
    summary = coverage_summary(out)
    assert summary["coverage"] > 0.8


def test_propagation_leaves_non_mask_pixels_untouched():
    seq, _ = _moving_occluder_sequence()
    before = seq.frames.copy()
    out = propagate(seq, max_hops=20)
    mid = seq.num_frames // 2
    untouched = ~seq.masks[mid]
    assert np.array_equal(out.frames[mid][untouched], before[mid][untouched])


def test_never_revealed_pixel_is_left_as_residual():
    seq, _ = _moving_occluder_sequence()
    # Force a pixel to be masked in EVERY frame (never revealed).
    seq.masks[:, 5, 5] = True
    out = propagate(seq, max_hops=20)
    resid = residual_mask(out)
    assert resid[seq.num_frames // 2, 5, 5]  # routed to synthesis, not filled
