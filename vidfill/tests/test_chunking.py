import numpy as np

from vidfill.io.chunking import blend_windows, crossfade_weights, make_windows


def test_windows_cover_all_frames():
    for n in (1, 10, 40, 41, 100, 137):
        wins = make_windows(n, window=40, overlap=8)
        # first starts at 0, last ends at n
        assert wins[0][0] == 0
        assert wins[-1][1] == n
        # contiguous coverage (no gaps)
        covered = np.zeros(n, dtype=bool)
        for s, e in wins:
            covered[s:e] = True
        assert covered.all()


def test_overlap_is_exact_between_neighbors():
    wins = make_windows(100, window=40, overlap=8)
    for (s0, e0), (s1, e1) in zip(wins, wins[1:]):
        # neighbour starts exactly `overlap` before the previous end (except a
        # possibly-shortened final window)
        assert s1 == s0 + (40 - 8)
        assert e0 - s1 == 8 or e1 == 100


def test_short_clip_is_single_window():
    assert make_windows(20, window=40, overlap=8) == [(0, 20)]
    assert make_windows(0, 40, 8) == []


def test_crossfade_weights_sum_to_one_on_overlap():
    # Two adjacent windows sharing `overlap` frames: weights over the shared
    # region must sum to 1 (a true crossfade, no brightness dip).
    overlap = 8
    left = crossfade_weights(40, left_overlap=0, right_overlap=overlap)
    right = crossfade_weights(40, left_overlap=overlap, right_overlap=0)
    tail = left[-overlap:]
    head = right[:overlap]
    np.testing.assert_allclose(tail + head, np.ones(overlap), atol=1e-6)


def test_blend_windows_reconstructs_constant_clip():
    n, h, w, c = 100, 4, 4, 3
    wins = make_windows(n, 40, 8)
    # each window returns a constant value equal to its own index — the crossfade
    # should produce a smooth ramp with no NaNs and correct endpoints.
    frames = [np.full((e - s, h, w, c), fill_value=float(k)) for k, (s, e) in enumerate(wins)]
    out = blend_windows((h, w, c), wins, frames, overlap=8)
    assert out.shape == (n, h, w, c)
    assert np.isfinite(out).all()
    assert np.isclose(out[0].mean(), 0.0)  # first window value
