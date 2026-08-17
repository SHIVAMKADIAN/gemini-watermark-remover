"""ProPainter video inpainting backend — adapter + contract.

ProPainter (sczhou/ProPainter) is a strong flow-guided video inpainter. Its
license is **S-Lab Non-Commercial** — fine for personal/research use, not for
commercial deployment (see NOTICE). Because of that license we do **not** vendor
its code or weights. Instead, point ``WM_PROPAINTER_DIR`` at your own clone of
the upstream repo (with weights fetched per its README) and this adapter drives
ProPainter's ``inference_propainter.py`` as a subprocess:

  frames+masks → PNG sequences on disk → ProPainter → filled PNGs → composite
  the filled result back over the *untouched* pixels (feathered by the mask), so
  everything outside the removal region stays byte-for-byte the original.

The subprocess approach is deliberately version-tolerant: we don't reimplement
ProPainter's RAFT/flow-completion/inpaint-net wiring (which drifts between
releases), we call the maintained script. When ``WM_PROPAINTER_DIR`` is unset or
invalid, ``__init__`` raises ``NotImplementedError`` and the registry falls back
to the always-available classical vidfill backend.

The disk/round-trip and command-building logic lives in module-level pure
functions so it is unit-testable without torch, a GPU, or the weights.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional, Sequence

import numpy as np

from ..config import Settings
from .base import ProgressCb, VideoInpainter, VideoResult


def _find_inference_script(propainter_dir: str) -> Path:
    """Return the path to inference_propainter.py inside a ProPainter checkout,
    or raise NotImplementedError with actionable guidance."""
    if not propainter_dir:
        raise NotImplementedError(
            "ProPainter backend needs WM_PROPAINTER_DIR pointing at a clone of "
            "https://github.com/sczhou/ProPainter (weights fetched per upstream). "
            "It is S-Lab NON-COMMERCIAL — see NOTICE. The classical vidfill backend "
            "is the permissive, always-available fallback."
        )
    root = Path(propainter_dir).expanduser()
    script = root / "inference_propainter.py"
    if not script.is_file():
        raise NotImplementedError(
            f"WM_PROPAINTER_DIR={propainter_dir!r} has no inference_propainter.py. "
            "Point it at a ProPainter checkout."
        )
    return script


def build_command(
    script: Path,
    frames_dir: Path,
    masks_dir: Path,
    out_dir: Path,
    width: int,
    height: int,
    settings: Settings,
    python: Optional[str] = None,
) -> list[str]:
    """Assemble the ProPainter CLI invocation (pure — no side effects)."""
    py = python or settings.propainter_python or sys.executable
    cmd = [
        py,
        str(script.name),  # run from cwd=script.parent so its relative imports resolve
        "--video", str(frames_dir),
        "--mask", str(masks_dir),
        "--output", str(out_dir),
        "--width", str(width),
        "--height", str(height),
        "--neighbor_length", str(settings.propainter_neighbor_length),
        "--ref_stride", str(settings.propainter_ref_stride),
        "--subvideo_length", str(settings.propainter_subvideo_length),
        "--raft_iter", str(settings.propainter_raft_iter),
        "--save_frames",
    ]
    if settings.propainter_fp16 and settings.device.startswith("cuda"):
        cmd.append("--fp16")
    return cmd


def write_frames(frames: np.ndarray, dest: Path, *, as_mask: bool = False) -> None:
    """Write a (T,H,W,3) frame stack — or a (T,H,W) bool mask stack — as
    zero-padded PNGs (00000.png…) into ``dest``. Masks are written white=hole,
    black=keep, matching ProPainter's expectation."""
    from PIL import Image

    dest.mkdir(parents=True, exist_ok=True)
    for i in range(frames.shape[0]):
        if as_mask:
            arr = (frames[i].astype(bool).astype(np.uint8)) * 255
            img = Image.fromarray(arr, mode="L")
        else:
            img = Image.fromarray(frames[i][..., :3].astype(np.uint8), mode="RGB")
        img.save(dest / f"{i:05d}.png")


def read_result_frames(result_dir: Path, count: int, size_hw: tuple[int, int]) -> np.ndarray:
    """Read ProPainter's per-frame output back into a (T,H,W,3) uint8 array,
    resized to ``size_hw`` (H,W) so it aligns with the originals. ProPainter nests
    frames under ``<result_dir>/<name>/frames/*.png`` (or writes them directly);
    we search for the deepest directory holding the right number of PNGs."""
    from PIL import Image

    h, w = size_hw
    pngs = _locate_frame_pngs(result_dir, count)
    if len(pngs) != count:
        raise RuntimeError(
            f"ProPainter produced {len(pngs)} frames under {result_dir} (expected {count})"
        )
    out = np.empty((count, h, w, 3), dtype=np.uint8)
    for i, p in enumerate(pngs):
        img = Image.open(p).convert("RGB")
        if img.size != (w, h):
            img = img.resize((w, h), Image.BICUBIC)
        out[i] = np.asarray(img, dtype=np.uint8)
    return out


def _locate_frame_pngs(result_dir: Path, count: int) -> list[Path]:
    """Find the PNG sequence ProPainter wrote. Prefer a directory whose PNG count
    matches ``count``; fall back to the largest PNG set under the tree."""
    best: list[Path] = []
    for d in [result_dir, *sorted(p for p in result_dir.rglob("*") if p.is_dir())]:
        pngs = sorted(d.glob("*.png"))
        if len(pngs) == count:
            return pngs
        if len(pngs) > len(best):
            best = pngs
    return best


def composite_over_original(
    originals: np.ndarray,
    filled: np.ndarray,
    masks: np.ndarray,
    settings: Settings,
) -> np.ndarray:
    """Feather the model output into the original ONLY within the (dilated) mask,
    so untouched pixels stay identical to the source — same invariant the
    classical backend guarantees."""
    from vidfill.composite.blend import composite
    from vidfill.masking.refine import refine_masks

    refined = refine_masks(masks.astype(bool), dilate_radius=2, median_window=1)
    out = np.empty_like(originals)
    for t in range(originals.shape[0]):
        out[t] = composite(originals[t], filled[t], refined[t], feather_radius=3)
    return out


class ProPainterInpainter(VideoInpainter):  # pragma: no cover - needs a ProPainter checkout + GPU
    name = "propainter"

    def __init__(self, device: str = "cuda", settings: Optional[Settings] = None):
        self.settings = settings or Settings()
        self.device = device
        self.script = _find_inference_script(self.settings.propainter_dir)

    def inpaint(
        self,
        frames: np.ndarray,
        masks: np.ndarray,
        progress: Optional[ProgressCb] = None,
    ) -> VideoResult:
        originals = frames.astype(np.uint8)
        t, h, w = originals.shape[:3]
        if progress:
            progress(0.05, "Preparing frames for ProPainter…")

        with tempfile.TemporaryDirectory(prefix="propainter-") as tmp:
            tmp_path = Path(tmp)
            frames_dir = tmp_path / "frames"
            masks_dir = tmp_path / "masks"
            out_dir = tmp_path / "out"
            write_frames(originals, frames_dir)
            write_frames(masks.astype(bool), masks_dir, as_mask=True)

            cmd = build_command(self.script, frames_dir, masks_dir, out_dir, w, h, self.settings)
            if progress:
                progress(0.15, "Running ProPainter (flow-guided inpainting)…")
            proc = subprocess.run(
                cmd,
                cwd=str(self.script.parent),
                capture_output=True,
                text=True,
                timeout=self.settings.propainter_timeout_s,
            )
            if proc.returncode != 0:
                tail = (proc.stderr or proc.stdout or "").strip()[-800:]
                raise RuntimeError(f"ProPainter failed (exit {proc.returncode}):\n{tail}")

            if progress:
                progress(0.85, "Compositing model output…")
            filled = read_result_frames(out_dir, t, (h, w))

        out_frames = composite_over_original(originals, filled, masks, self.settings)
        # The model synthesises the whole masked region, so temporal "coverage"
        # (retrieval-from-other-frames) isn't the right metric; report full.
        return VideoResult(frames=out_frames, coverage=1.0)


__all__: Sequence[str] = [
    "ProPainterInpainter",
    "build_command",
    "write_frames",
    "read_result_frames",
    "composite_over_original",
]
