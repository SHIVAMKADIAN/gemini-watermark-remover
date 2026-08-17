# OmniClean

A **local-first** web app for removing the visible corner watermark from
Gemini / Gemini Omni / Google Flow (Veo) images and videos that **you own or
are authorized to edit**.

Everything runs in your browser. **No file is ever uploaded** — no server, no
API, no analytics, no telemetry on your media. The processing math is
deterministic (reverse-alpha compositing), not generative inpainting, so the
result is predictable and never hallucinates detail.

> **This repository hosts four related projects.** The rest of this README
> documents **OmniClean**, the browser app (rooted at `src/`). The other three
> make up an optional server-side stack for heavier, model-based removal — see
> [Projects in this repository](#projects-in-this-repository) below.

---

## Projects in this repository

| Path       | Name         | What it is |
|------------|--------------|------------|
| `src/`     | **OmniClean**  | Local-first browser app (this README). Never uploads media; deterministic reverse-alpha + exemplar inpainting in Web Workers / WebCodecs. |
| `vidfill/` | **vidfill**    | Standalone Python library for flow-guided, retrieval-based video inpainting (user-drawn masks). Apache-2.0. |
| `server/`  | **wmserver**   | FastAPI service + async worker queue exposing image/video removal over HTTP. Pluggable backends (`auto` → LaMa / ProPainter → classical OpenCV + `vidfill` fallback). |
| `web/`     | **wmweb**      | Next.js (App Router) frontend for **wmserver** — upload, mark a region, submit, compare, download. |

**OmniClean is fully self-contained** and needs none of the others — it is a
static site (`npm run build` → `dist/`). The server stack (`vidfill` + `wmserver`
+ `wmweb`) is a separate, opt-in path for GPU model backends where media *is*
uploaded to your own server.

### Run the server stack (web + api) as one unit

```bash
docker compose up --build      # builds wmserver (CPU) + wmweb
# open http://localhost:3000    (API on http://localhost:8000)
```

This runs the **classical CPU** backends (OpenCV + `vidfill`), so it works
without a GPU. For LaMa / ProPainter, base the API image on CUDA and enable the
extras — see [`server/README.md`](server/README.md). Note ProPainter is
**non-commercial** licensed (flagged in `server/NOTICE`).

---

## What it does

- **Image cleanup** — PNG, JPEG, WebP. Preserves original resolution, format,
  and transparency. Output stays PNG (lossless container) / high-quality JPEG /
  WebP.
- **Video cleanup** — MP4. Preserves dimensions, duration, and frame rate.
  Copies the original audio stream through **without re-encoding** whenever the
  browser can. Uses WebCodecs via [Mediabunny](https://mediabunny.dev).
- **Resolution-aware watermark mask** — the region is computed from the media's
  actual pixel dimensions (never fixed CSS), so 720p/1080p, landscape/portrait
  all map correctly.
- **Three cleanup modes** — Auto / Soft / Standard.
- **Before/after comparison** — draggable slider, Original/Cleaned toggle,
  synchronized video playback, frame-by-frame stepping, and an amplified
  **Difference** view to confirm nothing outside the watermark changed.
- **Diagnostics** — "Show processing mask" overlay draws the exact restored
  region; a manual **region editor** lets you calibrate the box against your own
  export.
- **Batch** — queue many MP4s, process sequentially (memory-friendly), isolate
  failures so one bad file never stops the queue, download individually or as a
  ZIP.

---

## How the watermark restoration works

All methods operate **only inside a feathered rounded-rectangle mask**
generated at native resolution (`processing/watermark/mask.ts`). Pixels
outside it are provably untouched (mask alpha is exactly 0 there).

The mask region is reconstructed by one of three deterministic methods
(`src/profiles/*` picks per mode), none of which use generative AI:

**1. Exemplar-based fill — the default (`processing/watermark/exemplarInpaint.ts`)**

A Criminisi-style algorithm. The region is onion-peeled from its boundary
inward; for each patch on the fill front it searches the surrounding **original**
pixels for the best-matching texture patch (sum-of-squared-difference over the
already-known pixels) and copies it in. Because it copies real texture rather
than averaging, it **removes the mark without blurring** — it reconstructs the
background's detail (ground, walls, railings) instead of smearing it. Source
patches are only ever taken from original known pixels, never from synthesized
ones, so nothing is invented.

**2. Diffusion fill (`processing/watermark/inpaint.ts`)**

Edge-directed seed + Laplace/Gauss-Seidel smoothing. Fast and clean on flat
backgrounds, but blurs texture — kept as an internal option/fallback.

**3. Reverse-alpha (`processing/watermark/reverseAlpha.ts`)**

Inverts the watermark composite `observed = α·watermark + (1−α)·original`
→ `original ≈ (observed − α·watermark) / (1−α)`, per channel. Only valid when
the area under the mark is bright (on a dark background the subtraction clamps
to black), so it's reserved for the Soft mode. High-α pixels that can't be
stably inverted fall back to edge-directed fill
(`processing/watermark/fallbackFill.ts`).

Cleanup modes:
- **Auto** — exemplar fill. Recommended; removes the mark without blur on any
  background.
- **Soft** — reverse-alpha, for translucent marks on bright, simple backgrounds.
- **Standard** — exemplar fill with a wider texture search, for busy/detailed
  backgrounds.

Video uses a faster exemplar configuration per frame (coarser candidate stride,
tighter search window — see `toVideoPerfParams`), which keeps quality high while
running several-fold faster; measured ≈11 frames/s throughput for a 1080p corner
region on this dev machine.

### Video reconstruction engines: Spatial vs Temporal

Video offers two engines (picker on the Video tab):

- **Spatial** (default) — the exemplar/reverse-alpha methods above, run
  independently per frame.
- **Temporal (reveal)** — a browser-feasible reinterpretation of flow-guided
  video inpainting (inspired by the `vidfill` spec / ProPainter / FGVC line of
  work). Its principle is **retrieval, not generation**: when the scene or
  camera moves, the real background behind a static mark is exposed in *other*
  frames, so instead of guessing it spatially we find it and warp it in. Real
  pixels are temporally consistent by construction, which avoids the flicker of
  per-frame generation.

  Because RAFT/SAM2 don't run in a browser, the implementation uses **classical
  global-motion estimation** (`processing/video/motion.ts` — coarse-to-fine
  translation search on unmasked pixels) instead of dense learned flow, and the
  user's region mask instead of SAM2. Per window of frames it:
  1. estimates background motion between adjacent frames,
  2. for each masked pixel, chains that motion to nearby frames (probing
     ±1,±2,±4,±8,±16…) and takes a **single** bilinear sample from the first
     frame where the location is revealed (sample-once — no chained resampling
     blur),
  3. **Poisson-blends** the retrieved patch (`processing/video/poisson.ts`) so
     borrowed pixels from a differently-exposed frame don't leave a seam,
  4. routes pixels no frame ever revealed to the spatial exemplar fill.

  The result card reports the **temporal coverage** — the fraction of masked
  pixels satisfied from real background vs. filled spatially. The pipeline reads
  frames in overlapping windows (`processing/video/pipeline.ts`) so memory stays
  bounded, and audio is still copied through untouched.

  **Honest limits:** a *static camera over a static occluder* never reveals the
  background — coverage drops to ~0 and it falls back to spatial (surfaced in
  the coverage number). Motion is modelled as global translation/pan, so strong
  parallax, rotation, or zoom are only approximated. This is a classical
  approximation of the learned pipeline, not RAFT-grade dense flow.

### Watermark geometry (fixed-pixel logo model)

The visible Gemini/Veo watermark is a **fixed-size square logo** inset from a
corner — not a fraction of the frame. Profiles therefore specify the logo size
and margin **in pixels**, measured at a canonical export long-side, and the
resolver scales them linearly to the actual media's long side
(`profiles/registry.ts → geometryToPixels`). The Gemini figures (96 px logo /
192 px margin on a ~2816 px export, floored at 36 px) are taken from the
reverse-engineered profiles in
[allenk/GeminiWatermarkTool](https://github.com/allenk/GeminiWatermarkTool); a
legacy pre-3.5 "V1" profile (96/48 px logo, 64/32 px margin) is also included
in `profiles/gemini`. Video (Omni/Veo) figures are estimates in the same model,
since that reference covers images only.

Watermark profiles live in `src/profiles/{gemini,omni,veo}` and are trivially
extensible: each declares supported resolutions, the fixed-pixel logo geometry,
supported orientations, color/alpha characteristics, and per-mode cleanup
params. Because the box is now small and correctly placed, the mask disturbs far
less of the image — and the region editor / mask overlay let you calibrate it
against a specific export.

> **Calibration note.** The bundled geometry/alpha values are best-effort
> defaults. The reference watermark's exact pixel position/opacity varies by
> export; use **Adjust watermark region…** to fine-tune the box against your own
> file, and the Difference view / mask overlay to verify.

## How video & audio processing works

`processing/video/pipeline.ts` uses Mediabunny's `Conversion` API:

1. Demux + decode the MP4 (WebCodecs `VideoDecoder`).
2. For each frame, draw to an `OffscreenCanvas`, run the same reverse-alpha
   restoration on the pixel buffer (mask precomputed once, reused per frame),
   put it back.
3. Re-encode (WebCodecs `VideoEncoder`) and mux to MP4.
4. **Audio**: no audio `process`/`codec`/`quality` is set, so Mediabunny takes
   its fast path and **copies the encoded audio packets through unchanged**
   whenever the output container supports the source codec. The UI reports
   honestly whether passthrough happened.

All of this runs in a **Web Worker** (`workers/videoWorker.ts`) so the UI never
blocks. Video is necessarily **re-encoded** (to bake in the pixel changes), so
the app never claims bit-for-bit identical output — it states dimensions/
duration/fps are preserved and that encoding parameters may differ.

---

## Browser compatibility

- **Best:** latest **Chrome / Edge** (full WebCodecs, OffscreenCanvas).
- **Image cleanup** works anywhere `createImageBitmap` + `OffscreenCanvas` +
  workers exist (all modern browsers).
- **Video cleanup** requires **WebCodecs**. If unavailable, the video tab shows
  a clear message and the image workflow still works.
- The specific codecs available depend on the browser build. Standard Chrome/
  Edge include H.264; some open-source Chromium builds only ship VP9/AV1 (MP4
  supports those too).

---

## Run it

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
```

Other scripts:

```bash
npm run build      # type-check + production build (outputs dist/)
npm run preview    # serve the production build
npm run typecheck  # tsc project references
npm run lint       # oxlint
npm test           # unit tests (vitest) — 58 tests
```

### End-to-end verification (headless Chromium + Playwright)

These drive the real app, synthesize watermarked media in-browser, run the
actual pipelines, and inspect the resulting **pixels** to prove the watermark
region is restored while everything else is untouched. The dev server must be
running first.

```bash
npm run dev &        # in one shell
npm run verify:image # image pipeline + pixel check + UI
npm run verify:video # builds a real MP4, cleans it, checks pixels + audio passthrough
npm run verify:batch # 3-file queue incl. a corrupt file → failure isolation + ZIP
```

---

## Manual QA checklist

1. **Image** — drop a PNG/JPG/WebP. Confirm the media inspector shows correct
   resolution/format/transparency. Run each mode; use the slider, the
   Difference view (only the corner should light up), and the mask overlay.
   Download and re-open to confirm dimensions are unchanged.
2. **Unsupported image** — drop a `.gif`; expect a friendly format error and no
   crash.
3. **Video** — drop a 720p or 1080p (landscape and portrait) MP4. Confirm
   resolution/fps/codec/audio in the inspector. Clean it; scrub the synced
   comparison, step frames while paused, toggle the mask. Download and confirm
   dimensions/duration/audio are intact.
4. **Unsupported resolution** — a square or oddly-sized video shows a warning
   but still lets you proceed / adjust the region.
5. **No WebCodecs** — in a browser without it, the video tab shows the
   compatibility message and the image tab still works.
6. **Batch** — queue several clips plus one corrupt file. Confirm the corrupt
   one errors while the rest complete, per-item download works, and
   "Download all as ZIP" produces an archive.
7. **Privacy** — with the Network tab open, confirm no media bytes leave the
   page during processing.
8. **Accessibility** — tab through controls (visible focus rings), operate the
   comparison divider with arrow keys, and confirm `prefers-reduced-motion` is
   respected.

---

## Project structure

```
src/
  components/     UI (uploader, inspector, controls, comparison, editor, …)
  pages/          ImagePage, VideoPage, BatchPage
  hooks/          image/video processors, metadata, compare slider, batch reducer
  workers/        imageWorker, videoWorker (off-main-thread processing)
  processing/
    image/        metadata reader
    video/        metadata reader + Mediabunny pipeline
    watermark/    mask, reverse-alpha, fallback fill, restore, detect
  profiles/       gemini / omni / veo watermark profiles + registry
  utils/          validation, formatting, object-URL lifecycle, image format
  types/          shared types
scripts/          Playwright E2E verification (not shipped)
```

The UI never contains the watermark mathematics — all of it lives under
`processing/watermark/` and is unit-tested in isolation.

---

## Limitations & honesty

- **Not bit-for-bit lossless for video** — applying the pixel fix requires a
  re-encode. Dimensions/duration/fps are preserved; encoding parameters may
  differ from the source. The UI says so explicitly.
- **Audio passthrough depends on the browser/container** — when it can't copy,
  the UI tells you rather than silently degrading.
- **Profiles are best-effort defaults** — real exports vary; calibrate with the
  region editor and verify with the Difference/mask tools before trusting a
  batch run.
- **This tool is for media you own or are authorized to edit.**
- Dependencies are bundled locally (React, Mediabunny, JSZip). No runtime code
  or assets are fetched from a CDN.
