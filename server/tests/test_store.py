from wmserver.config import Settings
from wmserver.jobs.store import JobStore
from wmserver.models import JobParams, JobStatus, MediaKind


def _store(tmp_path):
    return JobStore(Settings(data_dir=tmp_path))


def test_create_get_update(tmp_path):
    store = _store(tmp_path)
    job = store.create(MediaKind.image, JobParams(kind=MediaKind.image), ".png")
    assert store.get(job.id) is job
    assert job.status == JobStatus.queued

    store.update(job.id, status=JobStatus.done, progress=1.0, coverage=0.9)
    got = store.get(job.id)
    assert got.status == JobStatus.done
    assert got.progress == 1.0
    assert got.view().result_available is False  # result file doesn't exist yet


def test_cleanup_removes_files_and_metadata(tmp_path):
    store = _store(tmp_path)
    job = store.create(MediaKind.image, JobParams(kind=MediaKind.image), ".png")
    job.source_path.write_bytes(b"x")
    job.result_path.write_bytes(b"y")
    store.cleanup(job.id)
    assert store.get(job.id) is None
    assert not job.source_path.exists()
    assert not job.result_path.exists()
