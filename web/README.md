# wmweb

Next.js (App Router) frontend for **wmserver** — upload media, drag a box over
the watermark/object to remove, submit, watch progress, and compare/download the
cleaned result. The heavy lifting happens on the server (LaMa / ProPainter /
classical); this is a thin, typed client.

## Run

```bash
# 1) start the API (see ../server)
cd ../server && wmserver           # http://localhost:8000

# 2) start the web app
cd ../web
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev   # http://localhost:3000
```

`NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`) points the client at
the API. The server must allow the web origin via `WM_CORS_ORIGINS`
(defaults already include `http://localhost:3000`).

## Flow

1. **Upload** an image (PNG/JPG/WebP) or MP4.
2. **Mark** a rectangular region over what to remove (drag on the preview). The
   region is stored as fractional coords, so it's resolution-independent.
3. **Submit** → a job is created on the API; the panel polls status/progress and
   shows the backend + temporal coverage (for video).
4. **Compare & download** the cleaned result.

## Build / checks

```bash
npm run build       # production build (type-checks + lints)
npm run typecheck   # tsc --noEmit
```

## E2E

`scripts/verify-web.mjs` drives the whole stack in a real browser (upload → draw
region → submit → poll → verify the region was inpainted). Requires both servers
running and the repo-root Playwright:

```bash
# with web on :3000 and api on :8000
node scripts/verify-web.mjs
```

## Notes

- **Server-backed**: media is uploaded to the API. This is the deliberate
  trade-off for running real PyTorch models (unlike the local-first OmniClean
  app in this repo, which never uploads).
- Video jobs need FFmpeg on the server. The classical video backend produces a
  result on CPU; LaMa/ProPainter need a GPU box (`WM_DEVICE=cuda` + extras).
