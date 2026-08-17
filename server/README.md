# wmserver

Server-backed watermark / object removal API. **FastAPI → job queue → worker →
inpainting backend.** The heavy models (LaMa via IOPaint for images, ProPainter
for video) plug in behind adapters on a GPU box; a **classical CPU fallback**
(OpenCV + the sibling `vidfill` package) runs everywhere so the service works
without a GPU.

```
client ──HTTP──▶ FastAPI ──enqueue──▶ JobQueue ──▶ Worker ──▶ Inpainter backend
                  (upload)             (memory/redis)          image: LaMa | classical-cv
                  (status/result)                              video: ProPainter | classical-vidfill
```

> Trade-off vs. the local-first browser tool (OmniClean): this **uploads media
> to a server**. That's what lets it run real PyTorch models. Keep that in mind
> for privacy-sensitive content.

## Backends

| Media | GPU backend            | Classical fallback (CPU, always available)                     |
|-------|------------------------|----------------------------------------------------------------|
| image | LaMa (IOPaint, Apache) | `classical-cv` — OpenCV Navier-Stokes/Telea inpaint            |
| video | ProPainter (**S-Lab non-commercial**) | `classical-vidfill` — vidfill flow-guided temporal retrieval + OpenCV residual fill |

`image_backend` / `video_backend` = `auto` (default) prefers the GPU model and
**falls back to classical** if the extra isn't installed — so a box with no GPU
still serves requests instead of erroring.

## Install & run

```bash
# classical (CPU) stack + tests — installs the sibling vidfill too
pip install -e ../vidfill
pip install -e '.[dev]'

wmserver --port 8000          # or: uvicorn wmserver.app:create_app --factory
pytest                        # 12 tests (API lifecycle, queue, store, processors)
```

GPU model backends (on a CUDA box):

```bash
pip install -e '.[lama]'        # IOPaint + torch  → high-quality image inpaint
pip install -e '.[propainter]'  # torch + weights  → video (NON-COMMERCIAL license)
WM_DEVICE=cuda WM_IMAGE_BACKEND=auto WM_VIDEO_BACKEND=auto wmserver
```

## API

| Method | Path                     | Purpose                                             |
|--------|--------------------------|-----------------------------------------------------|
| GET    | `/api/health`            | liveness + queue depth                              |
| POST   | `/api/jobs`              | multipart upload + params → create job (201)        |
| GET    | `/api/jobs/{id}`         | status / progress / coverage                        |
| GET    | `/api/jobs/{id}/result`  | download the cleaned file (409 until done)          |
| DELETE | `/api/jobs/{id}`         | delete job + files                                  |

Create a job (image, removing a corner region):

```bash
curl -F file=@photo.png -F kind=image \
     -F x=0.8 -F y=0.85 -F w=0.15 -F h=0.12 \
     http://localhost:8000/api/jobs
# → {"id":"...","status":"queued",...}
curl http://localhost:8000/api/jobs/<id>              # poll
curl -o clean.png http://localhost:8000/api/jobs/<id>/result
```

`region` (`x,y,w,h`) is fractional (0–1), resolution-independent. A video job
uses the same region on every frame (a fixed watermark/object); for a moving
object, supply per-frame masks from a tracker (see `media/masks.py`).

## Config (env, `WM_` prefix)

`WM_DATA_DIR`, `WM_MAX_UPLOAD_MB`, `WM_QUEUE_BACKEND` (`memory`|`redis`),
`WM_REDIS_URL`, `WM_WORKER_CONCURRENCY`, `WM_IMAGE_BACKEND`, `WM_VIDEO_BACKEND`,
`WM_DEVICE` (`cpu`|`cuda`). GPU-model knobs (`WM_LAMA_*`, `WM_PROPAINTER_*`) are
in `.env.example`.

## GPU model backends

The default install is CPU-only (classical OpenCV + `vidfill`) so everything
runs and is testable without a GPU. The two model backends are opt-in and slot
in behind `auto` (which prefers the model, falls back to classical on any
import/setup failure):

**LaMa (images)** — via IOPaint (Apache-2.0):

```bash
pip install '.[lama]'                 # torch + iopaint
export WM_DEVICE=cuda WM_IMAGE_BACKEND=auto   # auto → LaMa; classical if it can't load
```

The adapter degrades `cuda`→`cpu` if no GPU is visible, and re-asserts the
input resolution so the output always matches the source dimensions.

**ProPainter (video)** — S-Lab **NON-COMMERCIAL**, so it is *not* vendored.
Clone it yourself, fetch its weights, and point the server at the checkout:

```bash
git clone https://github.com/sczhou/ProPainter   # + fetch weights per its README
export WM_PROPAINTER_DIR=/abs/path/to/ProPainter
export WM_DEVICE=cuda WM_VIDEO_BACKEND=auto      # auto → ProPainter; classical otherwise
```

The adapter writes the frames+masks to a temp dir, runs ProPainter's
`inference_propainter.py` as a subprocess (version-tolerant — no reimplemented
model wiring), then **composites the model output back over the untouched
pixels** (feathered by the mask), so everything outside the removal region stays
byte-for-byte the original. Tuning knobs: `WM_PROPAINTER_{NEIGHBOR_LENGTH,
REF_STRIDE,SUBVIDEO_LENGTH,RAFT_ITER,FP16,PYTHON}`. If ProPainter pins a torch
version that clashes with the server's, install it in its own venv and set
`WM_PROPAINTER_PYTHON` to that interpreter.

## Notes / limitations

- **FFmpeg required for video** (decode/encode with H.264 + audio passthrough).
  The API surfaces a clear error if it's missing; image jobs need only Pillow.
- **ProPainter is S-Lab non-commercial** — fine for personal/research use, not
  commercial. LaMa weights carry their own terms. See `NOTICE`.
- The in-process queue is single-node; use `WM_QUEUE_BACKEND=redis` + multiple
  worker processes to scale out (the `RedisQueue` interface is stubbed).
