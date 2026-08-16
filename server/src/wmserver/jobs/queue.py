"""Pluggable job queue.

`InProcessQueue` is a dependency-free asyncio queue good for a single-node
deployment and for tests. `RedisQueue` is a stub showing the same interface for a
multi-worker / multi-node setup (install `wmserver[redis]`). The API enqueues
job IDs; the worker dequeues and processes them.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod


class JobQueue(ABC):
    @abstractmethod
    async def put(self, job_id: str) -> None: ...

    @abstractmethod
    async def get(self) -> str: ...

    @abstractmethod
    def qsize(self) -> int: ...


class InProcessQueue(JobQueue):
    def __init__(self) -> None:
        self._q: asyncio.Queue[str] = asyncio.Queue()

    async def put(self, job_id: str) -> None:
        await self._q.put(job_id)

    async def get(self) -> str:
        return await self._q.get()

    def task_done(self) -> None:
        self._q.task_done()

    def qsize(self) -> int:
        return self._q.qsize()


class RedisQueue(JobQueue):  # pragma: no cover - stub
    """Redis-backed queue for horizontal scaling. NOT IMPLEMENTED here.

    Contract: `put` RPUSHes the job id onto a list key; `get` BLPOPs it. Workers
    on other nodes share the same Redis. Install `wmserver[redis]` and wire it.
    """

    def __init__(self, url: str):
        raise NotImplementedError(
            "RedisQueue needs redis (pip install 'wmserver[redis]'). Use InProcessQueue "
            "for single-node; the worker loop is identical."
        )

    async def put(self, job_id: str) -> None:
        raise NotImplementedError

    async def get(self) -> str:
        raise NotImplementedError

    def qsize(self) -> int:
        raise NotImplementedError


def build_queue(backend: str, redis_url: str) -> JobQueue:
    if backend == "redis":
        return RedisQueue(redis_url)
    return InProcessQueue()
