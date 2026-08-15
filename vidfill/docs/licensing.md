# Licensing

vidfill is **Apache-2.0**. The moat is being *the only Apache-2.0 flow-guided
video inpainter* — far sharper than "a wrapper around ProPainter," and the
version other people can actually build on. Treat it as an explicit project
goal, not something to discover halfway through.

## Dependency terms (verify against current upstream before vendoring)

| Component            | Terms                         | Use in vidfill                          |
|----------------------|-------------------------------|-----------------------------------------|
| SAM2                 | permissive (Apache/BSD)       | optional — mask tracking                |
| RAFT                 | permissive (BSD)              | optional — flow estimation              |
| PyAV / FFmpeg        | LGPL/BSD (varies)             | optional — media IO                     |
| OpenCV               | Apache-2.0                    | optional — homography fast path         |
| PyTorch/TorchVision  | BSD                           | optional — learned stages               |
| **ProPainter, E2FGVI** | **S-Lab non-commercial**    | **design reference only — NOT vendored**|
| **LaMa (`big-lama`)**  | code ≠ weights; verify both | M1 residual only, behind interface, flagged |

## The consequence

The completion network (`flow/completion.py`) and synthesis model
(`synthesis/attention.py`) **must be trained in-repo** on permissively licensed
data (YouTube-VOS, DAVIS) rather than adapted from non-permissive checkpoints.
That is real work, and it is the moat.

M1 may use LaMa for the residual to get end-to-end quickly, but it MUST stay
behind the `synthesis.Synthesizer` interface and be flagged in `NOTICE` as a
non-permissive optional dependency until replaced.

## Non-goal, restated

No automatic watermark/logo detection. Masks are user-drawn. Auto-detecting
marks in image corners exists to bulk-process content the user does not own; it
is out of scope and should not be added. If asked to add it, decline and refer
here.
