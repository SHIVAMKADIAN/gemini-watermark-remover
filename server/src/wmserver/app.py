"""FastAPI application: upload → job → status → download."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .config import Settings, get_settings
from .jobs.queue import build_queue
from .jobs.store import JobStore
from .jobs.worker import Worker
from .models import JobParams, JobView, MediaKind, Region


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    settings = settings or get_settings()
    settings.ensure_dirs()
    store = JobStore(settings)
    queue = build_queue(settings.queue_backend, settings.redis_url)
    worker = Worker(store, queue, settings)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        await worker.start()
        try:
            yield
        finally:
            await worker.stop()

    app = FastAPI(title="wmserver", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.store = store
    app.state.queue = queue

    @app.get("/api/health")
    async def health() -> dict:
        return {"status": "ok", "queued": queue.qsize()}

    @app.post("/api/jobs", response_model=JobView, status_code=201)
    async def create_job(
        file: UploadFile = File(...),
        kind: MediaKind = Form(...),
        x: Optional[float] = Form(None),
        y: Optional[float] = Form(None),
        w: Optional[float] = Form(None),
        h: Optional[float] = Form(None),
        image_backend: Optional[str] = Form(None),
        video_backend: Optional[str] = Form(None),
        feather_radius: int = Form(3),
        dilate_radius: int = Form(6),
    ) -> JobView:
        region = None
        if None not in (x, y, w, h):
            region = Region(x=x, y=y, w=w, h=h)
        params = JobParams(
            kind=kind,
            region=region,
            image_backend=image_backend,
            video_backend=video_backend,
            feather_radius=feather_radius,
            dilate_radius=dilate_radius,
        )

        suffix = Path(file.filename or "").suffix or (".png" if kind == MediaKind.image else ".mp4")
        job = store.create(kind, params, suffix)

        data = await file.read()
        max_bytes = settings.max_upload_mb * 1024 * 1024
        if len(data) > max_bytes:
            store.cleanup(job.id)
            raise HTTPException(413, f"file exceeds {settings.max_upload_mb} MB limit")
        job.source_path.write_bytes(data)

        await queue.put(job.id)
        return job.view()

    @app.get("/api/jobs/{job_id}", response_model=JobView)
    async def get_job(job_id: str) -> JobView:
        job = store.get(job_id)
        if job is None:
            raise HTTPException(404, "job not found")
        return job.view()

    @app.get("/api/jobs/{job_id}/result")
    async def get_result(job_id: str) -> FileResponse:
        job = store.get(job_id)
        if job is None:
            raise HTTPException(404, "job not found")
        if job.status.value != "done" or not job.result_path.exists():
            raise HTTPException(409, f"result not ready (status={job.status.value})")
        media_type = "image/png" if job.kind == MediaKind.image else "video/mp4"
        return FileResponse(job.result_path, media_type=media_type, filename=job.result_path.name)

    @app.delete("/api/jobs/{job_id}", status_code=204)
    async def delete_job(job_id: str) -> None:
        store.cleanup(job_id)

    return app
