import numpy as np

from vidfill.composite.blend import composite, feather_alpha
from vidfill.composite.upscale import resize_bilinear


def test_untouched_pixels_are_byte_identical():
    rng = np.random.default_rng(1)
    h, w = 40, 50
    original = rng.integers(0, 256, size=(h, w, 3), dtype=np.uint8)
    filled = rng.integers(0, 256, size=(h, w, 3), dtype=np.uint8)
    mask = np.zeros((h, w), dtype=bool)
    mask[10:20, 15:30] = True

    out = composite(original, filled, mask, feather_radius=3)

    # Pixels where the feathered alpha is exactly 0 must equal the original
    # exactly — the invariant users notice immediately if it breaks.
    alpha = feather_alpha(mask, 3)
    untouched = alpha == 0.0
    assert np.array_equal(out[untouched], original[untouched])
    # And a far-away corner is definitely untouched.
    assert np.array_equal(out[0, 0], original[0, 0])


def test_mask_center_takes_the_filled_value():
    h, w = 30, 30
    original = np.zeros((h, w, 3), dtype=np.uint8)
    filled = np.full((h, w, 3), 200, dtype=np.uint8)
    mask = np.zeros((h, w), dtype=bool)
    mask[8:22, 8:22] = True
    out = composite(original, filled, mask, feather_radius=2)
    assert out[15, 15, 0] == 200  # solidly inside the mask


def test_feather_only_affects_near_the_edge():
    h, w = 30, 30
    mask = np.zeros((h, w), dtype=bool)
    mask[10:20, 10:20] = True
    alpha = feather_alpha(mask, 3)
    assert alpha[15, 15] == 1.0  # deep interior fully filled
    assert alpha[0, 0] == 0.0  # far outside untouched
    assert 0.0 < alpha[9, 15] < 1.0  # just outside the edge is a soft blend


def test_resize_bilinear_shape_and_range():
    img = np.random.default_rng(2).integers(0, 256, size=(16, 20, 3), dtype=np.uint8)
    up = resize_bilinear(img, 32, 40)
    assert up.shape == (32, 40, 3)
    assert up.dtype == np.uint8
    assert up.min() >= 0 and up.max() <= 255
