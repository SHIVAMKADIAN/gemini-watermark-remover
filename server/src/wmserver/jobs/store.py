"""Job metadata + file storage.

Metadata lives in memory (swap for SQLite/Postgres in production); the uploaded
source and produced result live on disk under the configured data dir. Keeping
this behind a small interface means the queue/worker/API don't care where it is.
"""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from ..config import Settings
from ..models import JobParams, JobStatus, JobView, MediaKind


@dataclass
class Job:
    id: str
    kind: MediaKind
    params: JobParams
    source_path: Path
    result_path: Path
    status: JobStatus = JobStatus.queued
    progress: float = 0.0
    message: str = ""
    backend: Optional[str] = None
    coverage: Optional[float] = None
    error: Optional[str] = None

    def view(self) -> JobView:
        return JobView(
            id=self.id,
            kind=self.kind,
            status=self.status,
            progress=self.progress,
            message=self.message,
            backend=self.backend,
            coverage=self.coverage,
            error=self.error,
            result_available=self.status == JobStatus.done and self.result_path.exists(),
        )


class JobStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        settings.ensure_dirs()
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(self, kind: MediaKind, params: JobParams, source_suffix: str) -> Job:
        job_id = uuid.uuid4().hex[:16]
        source_path = self.settings.uploads_dir / f"{job_id}{source_suffix}"
        result_suffix = ".png" if kind == MediaKind.image else ".mp4"
        result_path = self.settings.results_dir / f"{job_id}-clean{result_suffix}"
        job = Job(id=job_id, kind=kind, params=params, source_path=source_path, result_path=result_path)
        with self._lock:
            self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def update(self, job_id: str, **changes) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            for k, v in changes.items():
                setattr(job, k, v)

    def all(self) -> list[Job]:
        with self._lock:
            return list(self._jobs.values())

    def cleanup(self, job_id: str) -> None:
        """Remove a job's files and metadata (revocation / retention policy)."""
        with self._lock:
            job = self._jobs.pop(job_id, None)
        if job is None:
            return
        for p in (job.source_path, job.result_path):
            try:
                p.unlink()
            except FileNotFoundError:
                pass
