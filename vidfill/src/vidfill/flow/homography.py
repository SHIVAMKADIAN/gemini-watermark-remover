"""Homography fast path for in-hole flow.

Before invoking the completion network: fit a homography between consecutive
frames with RANSAC on features from *unmasked* regions only. For a static or
slowly-panning camera over roughly planar background — a large fraction of real
footage — this predicts in-hole flow almost exactly at a fraction of the cost.
Use it outright when the reprojection residual on unmasked pixels is low,
otherwise as initialization for the network.

Uses OpenCV when available (`vidfill[io]`); otherwise falls back to a NumPy
least-squares *translation* estimate, which already covers static/pan cameras
(the common case) and keeps the classical spine dependency-free.
"""

from __future__ import annotations

import numpy as np

from ..sampling import bilinear_sample, coordinate_grid
from ..types import Sequence

try:  # optional
    import cv2  # type: ignore

    _HAVE_CV2 = True
except Exception:  # pragma: no cover
    _HAVE_CV2 = False


def _dense_flow_from_homography(h_mat: np.ndarray, height: int, width: int) -> np.ndarray:
    xs, ys = coordinate_grid(height, width)
    ones = np.ones_like(xs)
    pts = np.stack([xs, ys, ones], axis=-1)  # (H,W,3)
    warped = pts @ h_mat.T
    wx = warped[..., 0] / warped[..., 2]
    wy = warped[..., 1] / warped[..., 2]
    return np.stack([wx - xs, wy - ys], axis=-1).astype(np.float32)


def _warp_error(frame_a: np.ndarray, frame_b: np.ndarray, flow: np.ndarray, usable: np.ndarray | None) -> float:
    """Photometric error of a flow candidate on unmasked pixels: sample b at
    p+flow(p) and compare to a(p). This is what actually tells us whether a flow
    explains the images — the acid test that rejects a wildly-extrapolating
    homography."""
    ga = frame_a.astype(np.float32).mean(axis=-1)
    gb = frame_b.astype(np.float32).mean(axis=-1)
    h, w = ga.shape
    xs, ys = coordinate_grid(h, w)
    sampled = bilinear_sample(gb, xs + flow[..., 0], ys + flow[..., 1])
    diff = np.abs(sampled - ga)
    if usable is not None and usable.any():
        return float(diff[usable].mean())
    return float(diff.mean())


def _homography_flow(frame_a: np.ndarray, frame_b: np.ndarray, usable: np.ndarray | None) -> np.ndarray | None:
    ga = cv2.cvtColor(frame_a, cv2.COLOR_RGB2GRAY)
    gb = cv2.cvtColor(frame_b, cv2.COLOR_RGB2GRAY)
    mask_u = None if usable is None else usable.astype(np.uint8) * 255
    pts_a = cv2.goodFeaturesToTrack(ga, maxCorners=600, qualityLevel=0.01, minDistance=7, mask=mask_u)
    if pts_a is None or len(pts_a) < 8:
        return None
    pts_b, st, _ = cv2.calcOpticalFlowPyrLK(ga, gb, pts_a, None)
    good = st.ravel() == 1
    if good.sum() < 8:
        return None
    a = pts_a[good].reshape(-1, 2)
    b = pts_b[good].reshape(-1, 2)
    h_mat, _ = cv2.findHomography(a, b, cv2.RANSAC, 3.0)
    if h_mat is None:
        return None
    return _dense_flow_from_homography(h_mat, frame_a.shape[0], frame_a.shape[1])


def estimate_pair(
    frame_a: np.ndarray,
    frame_b: np.ndarray,
    usable: np.ndarray | None,
) -> tuple[np.ndarray, float]:
    """Estimate dense flow a->b from a global model fit on unmasked pixels.

    Always computes the robust translation estimate; when OpenCV is available it
    also tries a homography and keeps it ONLY if it explains the unmasked pixels
    clearly better (photometric warp error). This guards against the classic
    homography failure — perfectly fitting sparse features while extrapolating
    nonsense into the hole. Returns (flow (H,W,2), photometric residual).
    """
    h, w = frame_a.shape[:2]
    dx, dy, _ = _translation_lstsq(frame_a, frame_b, usable)
    best_flow = np.zeros((h, w, 2), dtype=np.float32)
    best_flow[..., 0] = dx
    best_flow[..., 1] = dy
    best_err = _warp_error(frame_a, frame_b, best_flow, usable)

    if _HAVE_CV2:
        flow_h = _homography_flow(frame_a, frame_b, usable)
        if flow_h is not None:
            err_h = _warp_error(frame_a, frame_b, flow_h, usable)
            if err_h < best_err * 0.95:  # require a clear win to accept the homography
                best_flow, best_err = flow_h, err_h

    return best_flow, best_err


def _translation_lstsq(
    frame_a: np.ndarray, frame_b: np.ndarray, usable: np.ndarray | None, max_shift: int = 32
) -> tuple[float, float, float]:
    ga = frame_a.astype(np.float32).mean(axis=-1)
    gb = frame_b.astype(np.float32).mean(axis=-1)
    h, w = ga.shape
    if usable is None:
        usable = np.ones((h, w), dtype=bool)
    best = (0, 0, np.inf)
    step = max(1, min(h, w) // 64)
    for dy in range(-max_shift, max_shift + 1, 2):
        for dx in range(-max_shift, max_shift + 1, 2):
            ay0, ay1 = max(0, -dy), min(h, h - dy)
            ax0, ax1 = max(0, -dx), min(w, w - dx)
            if ay1 - ay0 < 8 or ax1 - ax0 < 8:
                continue
            a = ga[ay0:ay1:step, ax0:ax1:step]
            b = gb[ay0 + dy : ay1 + dy : step, ax0 + dx : ax1 + dx : step]
            m = usable[ay0:ay1:step, ax0:ax1:step]
            if m.sum() < 16:
                continue
            diff = (a - b)[m]
            cost = float(np.mean(diff * diff))
            if cost < best[2]:
                best = (dx, dy, cost)
    return float(best[0]), float(best[1]), float(np.sqrt(best[2]))


class HomographyFlow:
    """A drop-in `FlowEstimator` using the fast path for every adjacent pair."""

    version = "homography-1.0"

    def estimate(self, seq: Sequence) -> Sequence:
        n = seq.num_frames
        fwd = np.zeros((n - 1, seq.height, seq.width, 2), dtype=np.float32)
        bwd = np.zeros((n - 1, seq.height, seq.width, 2), dtype=np.float32)
        usable = None if seq.masks is None else ~seq.masks
        for i in range(n - 1):
            um = None if usable is None else (usable[i] & usable[i + 1])
            fwd[i], _ = estimate_pair(seq.frames[i], seq.frames[i + 1], um)
            bwd[i], _ = estimate_pair(seq.frames[i + 1], seq.frames[i], um)
        return seq.with_(flow_fwd=fwd, flow_bwd=bwd)
