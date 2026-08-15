#!/usr/bin/env python3
"""Benchmark: run the classical spine on the synthetic selftest clip and report
the CPU-only diagnostics (coverage, retrieval MAE, warping error).

Extend with real clips + ground-truth flow to track warping error and VFID over
time. Keeps to NumPy so it runs anywhere.
"""

from __future__ import annotations

import time

import numpy as np

from vidfill.metrics.warp_error import warp_error
from vidfill.pipeline import selftest


def main() -> int:
    t0 = time.perf_counter()
    report = selftest()
    dt = time.perf_counter() - t0
    print("vidfill benchmark (synthetic selftest clip)")
    print(f"  wall time     : {dt * 1000:.0f} ms")
    print(f"  coverage      : {report['coverage'] * 100:.1f}%")
    print(f"  retrieval MAE : {report['retrieval_mae']:.2f}")

    # Warping-error smoke check on two identical frames with zero flow (== 0).
    frame = np.zeros((16, 16, 3), dtype=np.uint8)
    flow = np.zeros((16, 16, 2), dtype=np.float32)
    print(f"  warp_error(id): {warp_error(frame, frame, flow):.3f} (expect 0.000)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
