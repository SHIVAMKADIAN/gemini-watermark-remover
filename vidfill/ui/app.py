#!/usr/bin/env python3
"""Optional Gradio UI (extra: `pip install 'vidfill[ui]'`).

Scaffold: wires the interactive mask-correction loop (click → SAM2 re-propagate)
to the pipeline once the learned stages are available. Falls back to a message
when Gradio isn't installed so the base package stays importable.
"""

from __future__ import annotations


def launch() -> None:  # pragma: no cover - optional UI
    try:
        import gradio as gr  # type: ignore
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(
            "The UI needs Gradio: pip install 'vidfill[ui]'. "
            f"(import error: {exc})"
        )

    def _placeholder(video, _clicks):
        return video  # TODO: wire masking.tracker + pipeline.run once weights exist

    with gr.Blocks(title="vidfill") as demo:
        gr.Markdown("# vidfill — flow-guided object removal\nMark the object, then Remove.")
        inp = gr.Video(label="Input")
        out = gr.Video(label="Result")
        gr.Button("Remove").click(_placeholder, inputs=[inp, gr.State([])], outputs=out)
    demo.launch()


if __name__ == "__main__":
    launch()
