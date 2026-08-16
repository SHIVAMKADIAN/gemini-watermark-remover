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
