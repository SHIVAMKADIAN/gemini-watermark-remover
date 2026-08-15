import numpy as np

from vidfill.flow.consistency import forward_backward_validity


def test_constant_flow_is_fully_consistent_interior():
    # A pure translation: forward (dx,dy), backward (-dx,-dy) round-trips exactly.
    h, w = 40, 50
    dx, dy = 3.0, -2.0
    fwd = np.zeros((h, w, 2), dtype=np.float32)
    fwd[..., 0] = dx
    fwd[..., 1] = dy
    bwd = -fwd
    valid = forward_backward_validity(fwd, bwd)
    # Interior pixels whose forward mapping stays in-bounds must be valid.
    interior = valid[5:-5, 5:-5]
    assert interior.mean() > 0.99


def test_occlusion_region_is_flagged_invalid():
    # Background translates by +2 in x; an occluder region has inconsistent
    # backward flow (points elsewhere) → must fail the check.
    h, w = 40, 60
    fwd = np.zeros((h, w, 2), dtype=np.float32)
    fwd[..., 0] = 2.0
    bwd = np.zeros((h, w, 2), dtype=np.float32)
    bwd[..., 0] = -2.0
    # Corrupt a block of backward flow so the round trip is far off.
    bwd[10:20, 10:20, 0] = 15.0
    valid = forward_backward_validity(fwd, bwd)
    assert valid[15, 15] == False  # noqa: E712 — inside the inconsistent block
    assert valid[30, 40] == True  # noqa: E712 — consistent elsewhere


def test_out_of_bounds_mapping_is_invalid():
    h, w = 20, 20
    fwd = np.zeros((h, w, 2), dtype=np.float32)
    fwd[..., 0] = 100.0  # maps everything far off-frame
    bwd = -fwd
    valid = forward_backward_validity(fwd, bwd)
    assert not valid.any()
