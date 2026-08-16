"""Worker: pull a job id, run the (blocking) inpaint off the event loop, update
the store. `process_job` is synchronous so it can be unit-tested directly; the
async `Worker` just drives it via a thread executor for concurrency.
"""

from __future__ import annotations

import asyncio
import logging

from ..config import Settings
from ..media.images import load_image, save_image
from ..media.masks import region_to_mask, region_to_mask_stack
from ..models import JobStatus, MediaKind
from ..processing.registry import select_image_backend, select_video_backend
from .queue import JobQueue
from .store import Job, JobStore

log = logging.getLogger("wmserver.worker")


def _process_image(store: JobStore, job: Job, settings: Settings) -> None:
    image = load_image(job.source_path)
    h, w = image.shape[:2]
    if job.params.region is None:
        raise ValueError("an image job needs a removal region")
    mask = region_to_mask(job.params.region, h, w)
    backend = select_image_backend(job.params.image_backend or settings.image_backend, settings.device)
    store.update(job.id, backend=backend.name, progress=0.3, message=f"Inpainting with {backend.name}…")
    out = backend.inpaint(image, mask)
    save_image(out, job.result_path)
    store.update(job.id, status=JobStatus.done, progress=1.0, message="Done", coverage=None)


def _process_video(store: JobStore, job: Job, settings: Settings) -> None:
    from ..media.video import decode_frames, encode_frames  # imported lazily (needs ffmpeg)

    frames, fps, has_audio = decode_frames(job.source_path)
    t, h, w = frames.shape[0], frames.shape[1], frames.shape[2]
    if job.params.region is None:
        raise ValueError("a video job needs a removal region")
    masks = region_to_mask_stack(job.params.region, t, h, w)
    backend = select_video_backend(job.params.video_backend or settings.video_backend, settings.device)
    store.update(job.id, backend=backend.name, progress=0.15, message=f"Processing with {backend.name}…")

    def on_progress(p: float, msg: str) -> None:
        store.update(job.id, progress=0.15 + p * 0.7, message=msg)

    result = backend.inpaint(frames, masks, progress=on_progress)
    store.update(job.id, progress=0.9, message="Encoding…")
    encode_frames(result.frames, fps, job.result_path, audio_source=job.source_path if has_audio else None)
    store.update(job.id, status=JobStatus.done, progress=1.0, message="Done", coverage=result.coverage)


def process_job(store: JobStore, job: Job, settings: Settings) -> None:
    """Run one job to completion (or error), updating the store as it goes."""
    try:
        store.update(job.id, status=JobStatus.processing, progress=0.05, message="Starting…", error=None)
        if job.kind == MediaKind.image:
            _process_image(store, job, settings)
        else:
            _process_video(store, job, settings)
    except Exception as exc:  # noqa: BLE001 — any failure becomes a job error, never crashes the worker
        log.exception("job %s failed", job.id)
        store.update(job.id, status=JobStatus.error, message="Failed", error=str(exc))


class Worker:
    def __init__(self, store: JobStore, queue: JobQueue, settings: Settings):
        self.store = store
        self.queue = queue
        self.settings = settings
        self._tasks: list[asyncio.Task] = []
        self._running = False

    async def start(self) -> None:
        self._running = True
        for _ in range(max(1, self.settings.worker_concurrency)):
            self._tasks.append(asyncio.create_task(self._loop()))

    async def stop(self) -> None:
        self._running = False
        for task in self._tasks:
            task.cancel()
        self._tasks.clear()

    async def _loop(self) -> None:
        loop = asyncio.get_event_loop()
        while self._running:
            try:
                job_id = await self.queue.get()
            except asyncio.CancelledError:  # pragma: no cover
                break
            job = self.store.get(job_id)
            if job is None:
                continue
            # Run the blocking inpaint off the event loop so the API stays responsive.
            await loop.run_in_executor(None, process_job, self.store, job, self.settings)
