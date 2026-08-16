"""Classical, CPU-only inpainting backends (no GPU, no model weights).

These are the always-available fallback so the whole service runs and is testable
without a GPU:

- Images: OpenCV Navier-Stokes / Telea inpainting.
- Video: vidfill's flow-guided retrieval pipeline (retrieval-first, real pixels
  from other frames; spatial fallback for never-revealed regions).

Swap in LaMa/ProPainter (processing/lama.py, processing/propainter.py) for higher
quality on a GPU.
"""

from __future__ import annotations

from typing import Optional

import numpy as np

from .base import ImageInpainter, ProgressCb, VideoInpainter, VideoResult

try:
    import cv2  # type: ignore

    _HAVE_CV2 = True
except Exception:  # pragma: no cover
    _HAVE_CV2 = False


class ClassicalImageInpainter(ImageInpainter):
    name = "classical-cv"

    def __init__(self, radius: int = 4, method: str = "telea"):
        self.radius = radius
        self.method = method

    def inpaint(self, image: np.ndarray, mask: np.ndarray) -> np.ndarray:
        if not _HAVE_CV2:  # pragma: no cover
            return _diffusion_inpaint(image, mask)
        alpha = None
        rgb = image
        if image.ndim == 3 and image.shape[2] == 4:
            alpha = image[..., 3]
            rgb = image[..., :3]
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        m = (mask.astype(np.uint8)) * 255
        flag = cv2.INPAINT_NS if self.method == "ns" else cv2.INPAINT_TELEA
        out_bgr = cv2.inpaint(bgr, m, self.radius, flag)
        out = cv2.cvtColor(out_bgr, cv2.COLOR_BGR2RGB)
        if alpha is not None:
            out = np.dstack([out, alpha])
        return out


class ClassicalVideoInpainter(VideoInpainter):
    """Complete classical video pipeline: vidfill flow-guided temporal retrieval
    (real pixels from other frames) followed by a per-frame spatial fill (OpenCV)
    for anything no frame revealed — so the output never keeps a hole. Reports the
    *temporal* coverage (how much was real retrieval vs. spatial guess)."""

    name = "classical-vidfill"

    def __init__(self, feather_radius: int = 3, dilate_radius: int = 6, max_hops: int = 50):
        self.feather_radius = feather_radius
        self.dilate_radius = dilate_radius
        self.max_hops = max_hops

    def inpaint(
        self,
        frames: np.ndarray,
        masks: np.ndarray,
        progress: Optional[ProgressCb] = None,
    ) -> VideoResult:
        # Imported lazily so the module loads even if vidfill isn't installed yet.
        from vidfill.composite.blend import composite
        from vidfill.flow.consistency import compute_validity
        from vidfill.flow.homography import HomographyFlow
        from vidfill.masking.refine import refine_masks
        from vidfill.propagation.coverage import coverage_summary, residual_mask
        from vidfill.propagation.recurrent import propagate
        from vidfill.types import Sequence

        originals = frames.astype(np.uint8)
        seq = Sequence(frames=originals.copy(), masks=masks.astype(bool))
        refined = refine_masks(seq.masks, self.dilate_radius, median_window=1)
        work = seq.with_(masks=refined)

        if progress:
            progress(0.1, "Estimating motion…")
        work = HomographyFlow().estimate(work)
        work = compute_validity(work)

        if progress:
            progress(0.4, "Retrieving background from other frames…")
        work = propagate(work, max_hops=self.max_hops)
        temporal_coverage = float(coverage_summary(work).get("coverage", 0.0))

        # Spatial residual: fill anything no frame revealed (per-frame OpenCV).
        if progress:
            progress(0.75, "Filling residual regions…")
        residual = residual_mask(work)
        image_fill = ClassicalImageInpainter()
        out_frames = np.empty_like(originals)
        for t in range(work.num_frames):
            filled = work.frames[t]
            if residual[t].any():
                filled = image_fill.inpaint(filled, residual[t])
            out_frames[t] = composite(originals[t], filled, refined[t], self.feather_radius)

        if progress:
            progress(0.95, "Compositing…")
        return VideoResult(frames=out_frames, coverage=temporal_coverage)


def _diffusion_inpaint(image: np.ndarray, mask: np.ndarray, iters: int = 200) -> np.ndarray:  # pragma: no cover
    """NumPy-only fallback if OpenCV is unavailable: Laplace diffusion into holes."""
    img = image[..., :3].astype(np.float32)
    hole = mask.astype(bool)
    for _ in range(iters):
        blurred = (
            np.roll(img, 1, 0) + np.roll(img, -1, 0) + np.roll(img, 1, 1) + np.roll(img, -1, 1)
        ) / 4.0
        img[hole] = blurred[hole]
    out = np.clip(img, 0, 255).astype(np.uint8)
    if image.ndim == 3 and image.shape[2] == 4:
        out = np.dstack([out, image[..., 3]])
    return out
