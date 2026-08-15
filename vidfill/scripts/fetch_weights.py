#!/usr/bin/env python3
"""Fetch model weights for the learned stages.

Downloads permissively-licensed weights (SAM2, RAFT) into ./weights and prints
guidance for the in-repo-trained completion/synthesis models. Verify each
license against current upstream terms before use (see NOTICE).

This is a scaffold: it lists the required artifacts and their destinations
rather than hard-coding URLs that rot. Fill in the resolved URLs for your
deployment.
"""

from __future__ import annotations

import pathlib

WEIGHTS = {
    "sam2": {
        "dest": "weights/sam2/",
        "license": "Apache-2.0 / BSD (verify)",
        "note": "Segment Anything 2 checkpoint for masking.tracker.Sam2Tracker.",
    },
    "raft": {
        "dest": "weights/raft/",
        "license": "BSD (verify)",
        "note": "RAFT-things checkpoint for flow.estimate.RaftFlow.",
    },
    "flow_completion": {
        "dest": "weights/flow_completion/",
        "license": "Apache-2.0 (in-repo trained)",
        "note": "Train with scripts/train_flow_completion.py on YouTube-VOS + DAVIS.",
    },
    "synthesis": {
        "dest": "weights/synthesis/",
        "license": "Apache-2.0 (in-repo trained) — or LaMa for M1 (non-permissive, see NOTICE)",
        "note": "Sparse-attention synthesizer. M1 may drop in LaMa behind the interface.",
    },
}


def main() -> int:
    root = pathlib.Path(__file__).resolve().parent.parent
    print("vidfill weights plan:\n")
    for name, spec in WEIGHTS.items():
        dest = root / spec["dest"]
        dest.mkdir(parents=True, exist_ok=True)
        print(f"  {name:16} -> {spec['dest']:26} [{spec['license']}]")
        print(f"      {spec['note']}")
    print(
        "\nResolve the download URLs for SAM2/RAFT in this script for your deployment,\n"
        "or place checkpoints in the directories above. Completion + synthesis are\n"
        "trained in-repo (Apache-2.0 goal)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
