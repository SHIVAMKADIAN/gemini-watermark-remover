"""wmserver — server-backed watermark/object removal API.

FastAPI + a pluggable job queue + a worker that dispatches to inpainting
backends (LaMa/ProPainter on GPU, or a classical CPU fallback). The heavy model
backends are optional; the API, queue, and classical fallback run without a GPU.
"""

__version__ = "0.1.0"
