"""
RailMind AI - Platform Schemas.
Pydantic v2 models for platform data validation and serialization.
"""

from typing import Any

from pydantic import BaseModel, Field, ConfigDict


class PlatformBase(BaseModel):
    """Base model for platform properties."""

    platform_id: str = Field(..., min_length=1, max_length=50, description="Unique platform identifier")
    platform_number: str = Field(..., min_length=1, max_length=20, description="Platform number")
    name: str = Field(..., min_length=1, max_length=100, description="Platform name")
    status: str = Field(default="FREE", pattern="^(FREE|OCCUPIED|MAINTENANCE|CLOSED)$")
    length_m: float = Field(..., gt=0.0, le=1000.0, description="Platform length in meters")
    station_id: str = Field(..., min_length=1, max_length=50, description="Parent station ID")


class PlatformCreate(PlatformBase):
    """Schema for creating a new platform."""

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "platform_id": "PLT_001_A",
            "platform_number": "1A",
            "name": "Platform 1A - North",
            "status": "FREE",
            "length_m": 250.0,
            "station_id": "STN_001",
        }
    })


class PlatformResponse(PlatformBase):
    """Schema for platform response with resolved relations."""

    station_name: str | None = Field(default=None, description="Parent station name")
    occupied_by: str | None = Field(default=None, description="Train occupying platform")
    connected_track: str | None = Field(default=None, description="Connected track segment")

    model_config = ConfigDict(from_attributes=True)


class PlatformAllocationRequest(BaseModel):
    """Schema for platform allocation request."""

    train_number: str = Field(..., min_length=1, max_length=20)
    station_id: str = Field(..., min_length=1, max_length=50)

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "train_number": "T123",
            "station_id": "STN_001",
        }
    })


class PlatformAllocationResponse(BaseModel):
    """Schema for platform allocation response."""

    success: bool
    train_number: str
    station_id: str
    platform: dict[str, Any] | None
    reason: str | None = None


class PlatformReleaseRequest(BaseModel):
    """Schema for platform release request."""

    platform_id: str = Field(..., min_length=1, max_length=50)

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "platform_id": "PLT_001_A",
        }
    })


class PlatformListResponse(BaseModel):
    """Schema for platform list response."""

    platforms: list[PlatformResponse]
    total: int
    station_id: str | None = None