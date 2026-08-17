"""Runtime configuration (env-driven)."""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="WM_", env_file=".env", extra="ignore")

    # Storage
    data_dir: Path = Path("./data")
    max_upload_mb: int = 512

    # CORS origins allowed to call the API from a browser (comma-separated in env,
    # e.g. WM_CORS_ORIGINS='["http://localhost:3000"]'). Defaults to local dev.
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Queue backend: "memory" (in-process) or "redis"
    queue_backend: str = "memory"
    redis_url: str = "redis://localhost:6379/0"
    worker_concurrency: int = 1

    # Inpainting backends. "auto" prefers the GPU model and falls back to
    # classical if it isn't installed/available.
    image_backend: str = "auto"  # auto | lama | classical
    video_backend: str = "auto"  # auto | propainter | classical

    # Model config
    lama_model: str = "lama"
    device: str = "cpu"  # cpu | cuda

    # LaMa (IOPaint). For very large images IOPaint can tile; "Original" sends the
    # full frame, "Resize"/"Crop" trade fidelity for VRAM. See IOPaint docs.
    lama_hd_strategy: str = "Crop"  # Original | Resize | Crop

    # ProPainter. The model + weights are NOT vendored (S-Lab NON-COMMERCIAL);
    # point WM_PROPAINTER_DIR at your own clone of https://github.com/sczhou/ProPainter
    # (with weights fetched per upstream). The adapter drives its inference script
    # as a subprocess and composites the result back over untouched pixels.
    propainter_dir: str = ""  # path to a ProPainter checkout; empty ⇒ backend unavailable
    propainter_python: str = ""  # python to run it with; empty ⇒ this interpreter
    propainter_neighbor_length: int = 10
    propainter_ref_stride: int = 10
    propainter_subvideo_length: int = 80
    propainter_raft_iter: int = 20
    propainter_fp16: bool = True
    propainter_timeout_s: int = 3600

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def results_dir(self) -> Path:
        return self.data_dir / "results"

    def ensure_dirs(self) -> None:
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
        _settings.ensure_dirs()
    return _settings
