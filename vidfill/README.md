# vidfill

Flow-guided video inpainting for object removal. **Apache-2.0.** Browser-free,
built to run on a consumer GPU with one command. You mark what to remove; the
system reconstructs the background behind it with frame-to-frame consistency.

> **Status: scaffold.** The classical spine (chunking, forward–backward
> consistency, sample-once propagation, coverage, compositing, warp-error
> metric) is implemented and unit-tested on CPU with NumPy. The learned stages
> (SAM2 mask tracking, RAFT flow, the flow-completion network, the synthesis
> transformer) are defined as clean, swappable interfaces with documented
> contracts and raise `NotImplementedError` until weights/training are wired on
> a GPU box. See `docs/build_order.md`.

## Core principle

**Retrieval, not generation.** Naive per-frame inpainting flickers because each
frame gets *a* plausible completion and they disagree. In real footage the
content behind a removed object is usually visible in *some other frame*
(revealed by parallax, object motion, or a pan). So the primary operation is to
find those pixels elsewhere in the sequence and warp them in — they are
consistent by construction because they are the same real pixels. Generation is
the fallback, only for regions never observed in any frame.

## Pipeline

```
Mask tracking   clicks -> SAM2 -> per-frame masks        (masking/)
Flow estimation RAFT between adjacent frames             (flow/estimate.py)
Flow completion re-infer flow inside the mask            (flow/completion.py)
Consistency     forward-backward check -> validity       (flow/consistency.py)   [implemented]
Propagation     chain correspondence, sample ONCE, merge (propagation/)          [implemented]
Synthesis       generative fill for residual holes only  (synthesis/)
Composite       upsample masked region, blend into frame (composite/)            [implemented]
```

Every stage is a pure function `Sequence -> Sequence` (see `types.py`), so
stages are independently testable, swappable, and cacheable.

## Install

```bash
pip install -e .            # classical spine + tests (NumPy only)
pip install -e '.[io]'      # + PyAV / OpenCV for real media IO & homography
pip install -e '.[models]'  # + PyTorch for the learned stages (GPU)
pip install -e '.[all]'
```

## Run

```bash
# Verify the classical core end-to-end on a synthetic sequence (no models, no GPU):
vidfill selftest

# Full run (requires the model extras + fetched weights):
vidfill run input.mp4 --mask session.json --config configs/default.yaml -o out.mp4
```

`vidfill selftest` constructs a synthetic clip with a moving occluder over a
static background, runs consistency + propagation + composite, and asserts the
background is retrieved and untouched pixels are byte-identical — the same
invariants the test suite checks.

## Tests

```bash
pytest            # runs the CPU/NumPy suite
```

- `tests/test_composite.py` — pixels outside the dilated mask are byte-identical
  to the input (the invariant that most easily breaks silently).
- `tests/test_consistency.py` — synthetic flow with analytically known
  occlusions; forward-backward validity has ground truth.
- `tests/test_chunking.py` — window overlap arithmetic and crossfade weights.
- `tests/test_propagation.py` — a moving occluder reveals the background;
  propagation retrieves the real pixel (retrieval, not generation).

## Non-goals

- **No automatic watermark/logo detection.** Masks are user-drawn. (Auto-marking
  corners to bulk-process content you don't own is out of scope by design.)
- No cloud service, upload endpoint, or hosted demo in this repo.
- No face/person-specific handling — the pipeline is object-agnostic.

## Licensing

Apache-2.0. The completion and synthesis models are to be trained in-repo on
permissively licensed data rather than adapted from non-permissive checkpoints
(ProPainter/E2FGVI are S-Lab non-commercial; LaMa weights carry their own
terms). See `NOTICE` and `docs/licensing.md`.
