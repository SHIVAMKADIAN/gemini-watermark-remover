"""Unit tests for the ProPainter adapter's torch-free plumbing: disk round-trip,
command building, compositing, and the graceful-fallback contract. The model
itself needs a GPU + a ProPainter checkout, so it isn't exercised here."""

from pathlib import Path

import numpy as np
import pytest

from wmserver.config import Settings
from wmserver.processing import propainter as pp
from wmserver.processing.registry import select_video_backend


def test_write_and_read_frames_roundtrip(tmp_path):
    t, h, w = 4, 12, 16
    frames = (np.arange(t * h * w * 3) % 256).astype(np.uint8).reshape(t, h, w, 3)
    frames_dir = tmp_path / "frames"
    pp.write_frames(frames, frames_dir)
    written = sorted(frames_dir.glob("*.png"))
    assert [p.name for p in written] == ["00000.png", "00001.png", "00002.png", "00003.png"]

    back = pp.read_result_frames(frames_dir, t, (h, w))
    assert back.shape == (t, h, w, 3)
    assert np.array_equal(back, frames)  # PNG is lossless


def test_write_mask_is_binary_white_hole(tmp_path):
    from PIL import Image

    masks = np.zeros((2, 8, 8), dtype=bool)
    masks[:, 2:5, 2:5] = True
    masks_dir = tmp_path / "masks"
    pp.write_frames(masks, masks_dir, as_mask=True)
    arr = np.asarray(Image.open(masks_dir / "00000.png").convert("L"))
    assert set(np.unique(arr)).issubset({0, 255})
    assert arr[3, 3] == 255 and arr[0, 0] == 0


def test_read_result_frames_finds_nested_dir(tmp_path):
    # ProPainter nests output under <out>/<name>/frames/*.png; the locator should
    # find the sequence whose count matches, regardless of depth.
    t, h, w = 3, 10, 10
    frames = np.full((t, h, w, 3), 128, np.uint8)
    nested = tmp_path / "out" / "video" / "frames"
    pp.write_frames(frames, nested)
    # A decoy directory with the wrong count must be ignored.
    pp.write_frames(np.zeros((1, h, w, 3), np.uint8), tmp_path / "out" / "decoy")
    back = pp.read_result_frames(tmp_path / "out", t, (h, w))
    assert back.shape == (t, h, w, 3)


def test_read_result_frames_resizes_to_target(tmp_path):
    frames = np.full((2, 6, 6, 3), 200, np.uint8)
    d = tmp_path / "f"
    pp.write_frames(frames, d)
    back = pp.read_result_frames(d, 2, (12, 18))  # upscale target
    assert back.shape == (2, 12, 18, 3)


def test_build_command_has_expected_flags(tmp_path):
    s = Settings(device="cuda", propainter_fp16=True, propainter_neighbor_length=8)
    cmd = pp.build_command(
        Path("/pp/inference_propainter.py"),
        tmp_path / "frames",
        tmp_path / "masks",
        tmp_path / "out",
        width=320,
        height=240,
        settings=s,
        python="python3",
    )
    assert cmd[0] == "python3"
    assert "inference_propainter.py" in cmd[1]
    assert "--fp16" in cmd  # cuda + fp16
    assert cmd[cmd.index("--width") + 1] == "320"
    assert cmd[cmd.index("--neighbor_length") + 1] == "8"


def test_build_command_omits_fp16_on_cpu(tmp_path):
    s = Settings(device="cpu", propainter_fp16=True)
    cmd = pp.build_command(
        Path("inference_propainter.py"),
        tmp_path, tmp_path, tmp_path, 64, 64, s,
    )
    assert "--fp16" not in cmd


def test_composite_preserves_untouched_pixels(tmp_path):
    t, h, w = 2, 20, 20
    originals = np.full((t, h, w, 3), 100, np.uint8)
    filled = np.full((t, h, w, 3), 200, np.uint8)  # model changed everything
    masks = np.zeros((t, h, w), dtype=bool)
    masks[:, 8:12, 8:12] = True
    out = pp.composite_over_original(originals, filled, masks, Settings())
    # A corner far from the (small, lightly dilated) mask is untouched.
    assert np.array_equal(out[0, 0, 0], originals[0, 0, 0])
    # The mask centre took the model's value.
    assert out[0, 10, 10, 0] > 150


def test_propainter_unavailable_falls_back(monkeypatch):
    # No WM_PROPAINTER_DIR → auto must yield the classical video backend.
    monkeypatch.delenv("WM_PROPAINTER_DIR", raising=False)
    assert select_video_backend("auto", Settings(propainter_dir="")).name == "classical-vidfill"


def test_propainter_explicit_without_dir_raises():
    with pytest.raises(NotImplementedError):
        select_video_backend("propainter", Settings(propainter_dir=""))
