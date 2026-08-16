"""API request/response schemas."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class MediaKind(str, Enum):
    image = "image"
    video = "video"


class JobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    done = "done"
    error = "error"


class Region(BaseModel):
    """Fractional removal rectangle (0..1), resolution-independent."""

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(gt=0, le=1)
    h: float = Field(gt=0, le=1)


class JobParams(BaseModel):
    """Processing parameters supplied at job creation."""

    kind: MediaKind
    region: Optional[Region] = None
    # image: which backend; "auto" resolves at run time
    image_backend: Optional[str] = None
    video_backend: Optional[str] = None
    feather_radius: int = 3
    dilate_radius: int = 6


class JobView(BaseModel):
    """What the API returns for a job."""

    id: str
    kind: MediaKind
    status: JobStatus
    progress: float = 0.0
    message: str = ""
    backend: Optional[str] = None
    coverage: Optional[float] = None
    error: Optional[str] = None
    result_available: bool = False
