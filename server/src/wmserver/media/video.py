"""Video decode/encode via FFmpeg (subprocess), gated on availability.

Decodes to (T, H, W, 3) uint8 and encodes frames back to MP4 while copying the
source audio stream unchanged (never re-encode audio; never touch untouched
pixels beyond the composited region — that is the caller's job). FFmpeg with an
H.264 encoder is required; when it isn't present, these raise a clear error and
the API surfaces it rather than producing a broken file.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import numpy as np


def ffmpeg_bin() -> str | None:
    return shutil.which("ffmpeg")


def ffprobe_bin() -> str | None:
    return shutil.which("ffprobe")


def have_ffmpeg() -> bool:
    return ffmpeg_bin() is not None


def probe(path: str | Path) -> dict:
    fp = ffprobe_bin()
    if fp is None:
        raise RuntimeError("ffprobe not found; install FFmpeg.")
    out = subprocess.check_output(
        [fp, "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)]
    )
    return json.loads(out)


def video_dimensions_fps(path: str | Path) -> tuple[int, int, float, bool]:
    """Return (width, height, fps, has_audio) from ffprobe."""
    info = probe(path)
    width = height = 0
    fps = 30.0
    has_audio = False
    for s in info.get("streams", []):
        if s.get("codec_type") == "video" and width == 0:
            width = int(s["width"])
            height = int(s["height"])
            num, den = (s.get("avg_frame_rate") or "30/1").split("/")
            fps = float(num) / float(den) if float(den) else 30.0
        elif s.get("codec_type") == "audio":
            has_audio = True
    return width, height, fps, has_audio


def decode_frames(path: str | Path) -> tuple[np.ndarray, float, bool]:
    """Decode all frames to (T, H, W, 3) uint8. Returns (frames, fps, has_audio)."""
    fb = ffmpeg_bin()
    if fb is None:
        raise RuntimeError("ffmpeg not found; install FFmpeg to process video.")
    width, height, fps, has_audio = video_dimensions_fps(path)
    if width == 0:
        raise RuntimeError("no video stream found")
    proc = subprocess.run(
        [fb, "-v", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE,
        check=True,
    )
    frame_size = width * height * 3
    n = len(proc.stdout) // frame_size
    frames = np.frombuffer(proc.stdout[: n * frame_size], dtype=np.uint8).reshape(n, height, width, 3)
    return frames.copy(), fps, has_audio


def encode_frames(
    frames: np.ndarray,
    fps: float,
    out_path: str | Path,
    audio_source: str | Path | None = None,
    crf: int = 16,
) -> None:
    """Encode (T,H,W,3) uint8 frames to H.264 MP4, copying audio from
    `audio_source` unchanged when present."""
    fb = ffmpeg_bin()
    if fb is None:
        raise RuntimeError("ffmpeg not found; install FFmpeg to process video.")
    t, h, w, _ = frames.shape
    cmd = [
        fb, "-v", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
    ]
    if audio_source is not None:
        cmd += ["-i", str(audio_source)]
    cmd += ["-map", "0:v:0"]
    if audio_source is not None:
        cmd += ["-map", "1:a:0?", "-c:a", "copy", "-shortest"]
    cmd += ["-c:v", "libx264", "-crf", str(crf), "-pix_fmt", "yuv420p", str(out_path)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    proc.stdin.write(np.ascontiguousarray(frames).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("ffmpeg encode failed")
