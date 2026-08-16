import numpy as np

from wmserver.processing.classical import ClassicalImageInpainter, ClassicalVideoInpainter
from wmserver.processing.registry import select_image_backend, select_video_backend


def test_classical_image_inpaint_removes_block():
    # Gradient background with a bright red block; mask the block.
    h, w = 60, 80
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[..., 1] = (np.linspace(0, 255, w)[None, :]).astype(np.uint8)  # green ramp
    img[20:40, 30:50] = [255, 0, 0]
    mask = np.zeros((h, w), dtype=bool)
    mask[20:40, 30:50] = True

    out = ClassicalImageInpainter().inpaint(img, mask)
    # Center of the block should no longer be pure red.
    r, g, b = out[30, 40]
    assert not (r > 200 and g < 60 and b < 60), f"block not inpainted: {out[30, 40]}"
    # A pixel outside the mask is untouched.
    assert np.array_equal(out[5, 5], img[5, 5])


def test_classical_image_preserves_alpha():
    img = np.dstack([np.full((20, 20, 3), 100, np.uint8), np.full((20, 20), 128, np.uint8)])
    mask = np.zeros((20, 20), dtype=bool)
    mask[5:10, 5:10] = True
    out = ClassicalImageInpainter().inpaint(img, mask)
    assert out.shape[2] == 4
    assert np.array_equal(out[..., 3], img[..., 3])


def test_classical_video_inpaint_fills_and_reports_coverage():
    # Static background with a moving occluder → temporal retrieval should fill it.
    rng = np.random.default_rng(0)
    t, h, w = 7, 40, 56
    yy, xx = np.mgrid[0:h, 0:w]
    bg = np.clip((0.6 * xx + 0.4 * yy) % 256 + rng.integers(0, 30, (h, w)), 0, 255).astype(np.uint8)
    frames = np.broadcast_to(bg[None, :, :, None], (t, h, w, 3)).copy()
    masks = np.zeros((t, h, w), dtype=bool)
    for i in range(t):
        x0 = 4 + i * 5
        frames[i, 15:23, x0 : x0 + 8] = [255, 0, 255]
        masks[i, 15:23, x0 : x0 + 8] = True

    res = ClassicalVideoInpainter().inpaint(frames, masks)
    assert res.coverage is not None and res.coverage > 0.5
    # No raw magenta left in a middle frame.
    mid = t // 2
    magenta = np.all(res.frames[mid][masks[mid]] == [255, 0, 255], axis=-1).any()
    assert not magenta


def test_registry_auto_falls_back_to_classical_without_gpu():
    # No torch/iopaint/propainter here → auto must yield the classical backends.
    assert select_image_backend("auto").name == "classical-cv"
    assert select_video_backend("auto").name == "classical-vidfill"
