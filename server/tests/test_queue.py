import asyncio

from wmserver.jobs.queue import InProcessQueue, build_queue


def test_in_process_queue_fifo():
    async def run():
        q = InProcessQueue()
        await q.put("a")
        await q.put("b")
        assert q.qsize() == 2
        assert await q.get() == "a"
        assert await q.get() == "b"

    asyncio.run(run())


def test_build_queue_defaults_to_memory():
    q = build_queue("memory", "redis://x")
    assert isinstance(q, InProcessQueue)
