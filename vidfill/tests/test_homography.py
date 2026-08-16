import numpy as np

from vidfill.flow.homography import HomographyFlow, estimate_pair


def _static_scene(shift=(0, 0)):
    rng = np.random.default_rng(7)
    h, w = 48, 64
    yy, xx = np.mgrid[0:h, 0:w]
    bg = np.clip((0.5 * xx + 0.3 * yy) % 256 + rng.integers(0, 25, (h, w)), 0, 255).astype(np.uint8)
    a = np.repeat(bg[:, :, None], 3, axis=2)
    # frame b is the same scene shifted (a small pan) — flow a->b ≈ -shift
    b = np.roll(a, (shift[1], shift[0]), axis=(0, 1))
    return a, b


def test_static_scene_flow_is_near_zero_and_stable():
    # Regression: with OpenCV present, a wildly-extrapolating homography must be
    # rejected in favor of the stable estimate (photometric-warp gating).
    a, b = _static_scene((0, 0))
    flow, err = estimate_pair(a, b, usable=None)
    assert np.abs(flow).max() <= 2.0, f"unstable flow on a static scene: max {np.abs(flow).max()}"
    assert err < 20.0


def test_homography_flow_stage_shapes():
    a, b = _static_scene((0, 0))
    seq_frames = np.stack([a, b, a], axis=0)
    from vidfill.types import Sequence

    seq = Sequence(frames=seq_frames)
    out = HomographyFlow().estimate(seq)
    assert out.flow_fwd.shape == (2, 48, 64, 2)
    assert out.flow_bwd.shape == (2, 48, 64, 2)
