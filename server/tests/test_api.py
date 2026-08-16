import io
import time

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from wmserver.app import create_app
from wmserver.config import Settings


def _client(tmp_path):
    settings = Settings(data_dir=tmp_path, queue_backend="memory", worker_concurrency=1)
    return TestClient(create_app(settings))


def _png_with_block() -> bytes:
    h, w = 60, 80
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    arr[..., 1] = np.linspace(0, 255, w)[None, :].astype(np.uint8)
    arr[20:40, 30:50] = [255, 0, 0]
    buf = io.BytesIO()
    Image.fromarray(arr, "RGB").save(buf, format="PNG")
    return buf.getvalue()


def _poll(client, job_id, timeout=10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/api/jobs/{job_id}")
        st = r.json()
        if st["status"] in ("done", "error"):
            return st
        time.sleep(0.05)
    raise AssertionError("job did not finish in time")


def test_health(tmp_path):
    with _client(tmp_path) as client:
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


def test_image_job_end_to_end(tmp_path):
    with _client(tmp_path) as client:
        files = {"file": ("block.png", _png_with_block(), "image/png")}
        data = {
            "kind": "image",
            # region over the red block: x 30/80=0.375, y 20/60=0.333, w 20/80=0.25, h 20/60=0.333
            "x": "0.375",
            "y": "0.333",
            "w": "0.25",
            "h": "0.334",
            "image_backend": "classical",
        }
        r = client.post("/api/jobs", files=files, data=data)
        assert r.status_code == 201, r.text
        job = r.json()
        assert job["status"] == "queued"

        final = _poll(client, job["id"])
        assert final["status"] == "done", final
        assert final["backend"] == "classical-cv"
        assert final["result_available"] is True

        # Download the result and confirm the block was inpainted (not pure red).
        res = client.get(f"/api/jobs/{job['id']}/result")
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
        out = np.asarray(Image.open(io.BytesIO(res.content)).convert("RGB"))
        r_, g_, b_ = out[30, 40]
        assert not (r_ > 200 and g_ < 60 and b_ < 60), f"block not inpainted: {out[30, 40]}"


def test_missing_region_errors_the_job(tmp_path):
    with _client(tmp_path) as client:
        files = {"file": ("block.png", _png_with_block(), "image/png")}
        r = client.post("/api/jobs", files=files, data={"kind": "image", "image_backend": "classical"})
        assert r.status_code == 201
        final = _poll(client, r.json()["id"])
        assert final["status"] == "error"
        assert "region" in (final["error"] or "").lower()


def test_unknown_job_404(tmp_path):
    with _client(tmp_path) as client:
        assert client.get("/api/jobs/does-not-exist").status_code == 404
        assert client.get("/api/jobs/does-not-exist/result").status_code == 404
