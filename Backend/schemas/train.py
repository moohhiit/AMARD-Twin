"""
RailMind AI - Train Schemas.
Pydantic v2 models for train data validation and serialization.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, ConfigDict


class TrainBase(BaseModel):
    """Base model for train properties."""

    train_number: str = Field(..., min_length=1, max_length=20, description="Unique train identifier")
    name: str = Field(..., min_length=1, max_length=100, description="Train name")
    status: str = Field(default="MOVING", pattern="^(MOVING|STOPPED|DELAYED|WAITING|MAINTENANCE|RUNNING)$")
    speed: float = Field(default=0.0, ge=0.0, le=300.0, description="Current speed in km/h")
    direction: str = Field(default="FORWARD", pattern="^(FORWARD|REVERSE|NORTH|SOUTH|EAST|WEST)$")
    current_track: str = Field(..., min_length=1, max_length=50, description="Current track segment ID")
    next_track: str | None = Field(default=None, max_length=50, description="Next track segment ID")
    route_id: str | None = Field(default=None, max_length=50, description="Assigned route ID")
    progress_on_track: float = Field(default=0.0, ge=0.0, le=100.0, description="Progress percentage on current track")
    train_length_m: float = Field(..., gt=0.0, le=1000.0, description="Train length in meters")
    current_platform: str | None = Field(default=None, max_length=50, description="Current platform ID if at station")


class TrainCreate(TrainBase):
    """Schema for creating a new train."""

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "train_number": "T123",
            "name": "Express 101",
            "status": "MOVING",
            "speed": 80.0,
            "direction": "FORWARD",
            "current_track": "TRK_001",
            "next_track": "TRK_002",
            "route_id": "RTE_001",
            "progress_on_track": 45.0,
            "train_length_m": 200.0,
            "current_platform": None,
        }
    })


class TrainUpdate(BaseModel):
    """Schema for updating train properties."""

    status: str | None = Field(default=None, pattern="^(MOVING|STOPPED|DELAYED|WAITING|MAINTENANCE|RUNNING)$")
    speed: float | None = Field(default=None, ge=0.0, le=300.0)
    current_track: str | None = Field(default=None, max_length=50)
    next_track: str | None = Field(default=None, max_length=50)
    route_id: str | None = Field(default=None, max_length=50)
    progress_on_track: float | None = Field(default=None, ge=0.0, le=100.0)
    current_platform: str | None = Field(default=None, max_length=50)

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "status": "STOPPED",
            "speed": 0.0,
            "progress_on_track": 100.0,
        }
    })


class TrainResponse(TrainBase):
    """Schema for train response with metadata."""

    last_updated: datetime | None = Field(default=None, description="Last update timestamp")
    current_track_id: str | None = Field(default=None, description="Resolved track ID")
    zone_id: str | None = Field(default=None, description="Resolved zone ID")

    model_config = ConfigDict(from_attributes=True)


class TrainPositionUpdate(BaseModel):
    """Schema for position update requests."""

    train_number: str = Field(..., min_length=1, max_length=20)
    current_track: str = Field(..., min_length=1, max_length=50)
    next_track: str | None = Field(default=None, max_length=50)
    progress_on_track: float = Field(..., ge=0.0, le=100.0)
    speed: float = Field(..., ge=0.0, le=300.0)
    status: str = Field(..., pattern="^(MOVING|STOPPED|DELAYED|WAITING|MAINTENANCE|RUNNING)$")

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "train_number": "T123",
            "current_track": "TRK_002",
            "next_track": "TRK_003",
            "progress_on_track": 10.0,
            "speed": 85.0,
            "status": "MOVING",
        }
    })


class TrainListResponse(BaseModel):
    """Schema for paginated train list response."""

    trains: list[TrainResponse]
    total: int
    page: int = 1
    page_size: int = 50


class TrainFullGraph(BaseModel):
    """Schema for train with full graph relationships."""

    train: dict[str, Any]
    current_track: dict[str, Any] | None
    next_track: dict[str, Any] | None
    zone: dict[str, Any] | None
    route: dict[str, Any] | None
    platform: dict[str, Any] | None