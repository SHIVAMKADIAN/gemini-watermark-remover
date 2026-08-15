# Build order

Ship a working end-to-end pipeline before refining any stage. Status marks what
this scaffold already implements (✅) vs. what remains (⬜, needs GPU/models).

## M1 — end-to-end skeleton
- ✅ Types (`Sequence`), chunking + crossfade, mask refine (dilate/median),
  RLE session (de)serialization.
- ✅ Homography/translation flow fast path (classical, no GPU).
- ✅ Forward–backward consistency → validity.
- ✅ Sample-once bidirectional propagation + coverage.
- ✅ Feathered composite (untouched-pixel invariant) + masked-region upscale.
- ✅ `vidfill selftest` runs the above on synthetic data and is unit-tested.
- ⬜ SAM2 masking, RAFT flow, PyAV IO, per-frame LaMa residual — wire behind the
  existing interfaces to process real MP4s.

## M2 — consistency and merge (biggest quality jump per unit effort)
- ✅ Forward–backward validity, bidirectional nearest-wins merge, coverage map.
- ⬜ Poisson seam blend (per hole component, solved at low res), reprojection
  guard for slow-drift chains.

## M3 — flow completion network
- ⬜ Edge inpainting, recurrent edge-constrained completion, training script
  (`scripts/train_flow_completion.py`, recipe in its docstring).

## M4 — synthesis
- ⬜ Sparse spatiotemporal attention transformer (masked queries only), keyframe
  fallback for static-camera + static-occluder scenes.

## M5 — packaging
- ✅ pyproject with extras (`io`/`models`/`ui`/`dev`), CLI entry point, configs,
  Apache-2.0 LICENSE + NOTICE.
- ⬜ One-command weight fetch, Gradio UI wiring, published docs.

## The failures worth instrumenting (from the spec)
- **Slow smooth camera drift over static background:** chains run long, per-hop
  consistency passes, tiny errors accumulate into a real offset → soft
  double-edge. Guard with an explicit reprojection check (warp the *source*
  forward through the chain, compare on unmasked pixels near the hole).
- **Static camera + static occluder:** nothing is revealed; coverage → 0. This
  is pure generation with a low ceiling — surface it, don't silently mush.
- **Stochastic backgrounds** (water/foliage/crowds/fire): high-entropy true
  flow; propagated pixels look frozen. Detect via high flow variance in the
  surrounding ring and route to synthesis.
