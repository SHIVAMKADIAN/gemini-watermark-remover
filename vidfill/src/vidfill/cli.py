"""vidfill command-line interface.

`vidfill selftest` runs the classical spine on synthetic data (no models, no
GPU). `vidfill run` is the full pipeline and requires the model extras + weights.
"""

from __future__ import annotations

import argparse
import sys


def _cmd_selftest(_args: argparse.Namespace) -> int:
    from .pipeline import selftest

    report = selftest()
    print("vidfill selftest: PASS")
    print(f"  coverage      : {report['coverage'] * 100:.1f}% of masked pixels retrieved")
    print(f"  retrieval MAE : {report['retrieval_mae']:.2f} (0-255)")
    print(f"  masked pixels : {int(report['masked_pixels'])}")
    return 0


def _cmd_run(args: argparse.Namespace) -> int:
    print(
        "vidfill run: the full pipeline needs the learned stages (SAM2, RAFT, "
        "flow completion, synthesis).\n"
        "Install the extras and fetch weights first:\n"
        "  pip install -e '.[all]'\n"
        "  python scripts/fetch_weights.py\n"
        f"(requested: input={args.input!r} mask={args.mask!r} config={args.config!r} out={args.output!r})",
        file=sys.stderr,
    )
    return 2


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vidfill", description="Flow-guided video inpainting")
    sub = parser.add_subparsers(dest="command", required=True)

    p_self = sub.add_parser("selftest", help="Verify the classical spine on synthetic data (no GPU).")
    p_self.set_defaults(func=_cmd_selftest)

    p_run = sub.add_parser("run", help="Run the full pipeline on a video (needs model extras).")
    p_run.add_argument("input", help="Input video path")
    p_run.add_argument("--mask", required=True, help="Mask session JSON (see masking.session)")
    p_run.add_argument("--config", default="configs/default.yaml")
    p_run.add_argument("-o", "--output", default="out.mp4")
    p_run.set_defaults(func=_cmd_run)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
