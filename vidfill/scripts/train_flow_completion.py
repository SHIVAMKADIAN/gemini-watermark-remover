#!/usr/bin/env python3
"""Train the flow-completion network (in-repo, permissive data).

Scaffold entry point. The training loop is intentionally not implemented here —
it requires torch + the datasets — but the *recipe* is fixed by the spec and
encoded below so the implementation follows it:

Data
  YouTube-VOS + DAVIS. Sample masks from TWO distributions:
    (a) free-form strokes, and
    (b) real object silhouettes from segmentation datasets.
  Object-shaped masks matter: the shape statistics of "a person you want removed"
  differ sharply from random blobs and the net overfits to whatever it sees.

Model
  Edge-constrained, recurrent (deformable alignment between adjacent flow fields),
  bidirectional. Complete flow EDGES first, then fill the field with edges as a
  hard constraint.

Losses (weight, most-important-first)
  1. Photometric warp loss  — warp frame t+1 back to t with completed flow, L1 on
     pixels unmasked in both. Self-supervised; the anchor.
  2. L1 to pseudo-GT (RAFT on clean video) — lower weight; bakes in RAFT's errors.
  3. Edge-aware 2nd-order smoothness — down-weighted where completed edges fire.

Run
  python scripts/train_flow_completion.py --data /path/to/yvos_davis --out weights/flow_completion
"""

from __future__ import annotations

import argparse


def main() -> int:
    ap = argparse.ArgumentParser(description="Train vidfill flow-completion net")
    ap.add_argument("--data", required=True, help="Root of YouTube-VOS + DAVIS")
    ap.add_argument("--out", default="weights/flow_completion")
    ap.add_argument("--epochs", type=int, default=200)
    ap.add_argument("--mask-mix", type=float, default=0.5, help="fraction of object-silhouette masks")
    args = ap.parse_args()
    raise SystemExit(
        "train_flow_completion is a scaffold. Implement the torch training loop per the "
        f"recipe in this file's docstring (data={args.data!r}, out={args.out!r}). "
        "Requires vidfill[models]."
    )


if __name__ == "__main__":
    raise SystemExit(main())
