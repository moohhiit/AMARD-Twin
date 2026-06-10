"""
RailMind AI - Signal Schemas.
Pydantic v2 models for signal data validation and serialization.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, ConfigDict


class SignalBase(BaseModel):
    """Base model for signal properties."""

    signal_id: str = Field(..., min_length=1, max_length=50, description="Unique signal identifier")
    state: str = Field(default="RED", pattern="^(GREEN|RED|YELLOW|FLASHING)$")
    controlled_track: str = Field(..., min_length=1, max_length=50, description="Controlled track segment ID")


class SignalCreate(SignalBase):
    """Schema for creating a new signal."""

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "signal_id": "SIG_001",
            "state": "RED",
            "controlled_track": "TRK_001",
        }
    })


class SignalUpdate(BaseModel):
    """Schema for signal state update."""

    state: str = Field(..., pattern="^(GREEN|RED|YELLOW|FLASHING)$")

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "state": "GREEN",
        }
    })


class SignalResponse(SignalBase):
    """Schema for signal response with metadata."""

    protected_track: str | None = Field(default=None, description="Protected track segment")
    occupied_by: str | None = Field(default=None, description="Train on protected track")
    last_changed: datetime | None = Field(default=None, description="Last state change timestamp")

    model_config = ConfigDict(from_attributes=True)


class SignalSafetyRequest(BaseModel):
    """Schema for signal safety check request."""

    track_id: str = Field(..., min_length=1, max_length=50)
    requesting_train_number: str = Field(..., min_length=1, max_length=20)

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "track_id": "TRK_001",
            "requesting_train_number": "T123",
        }
    })


class SignalSafetyResponse(BaseModel):
    """Schema for signal safety check response."""

    track_id: str
    is_clear: bool
    is_occupied: bool
    occupant_train: str | None
    under_maintenance: bool
    maintenance_block: str | None
    downstream_blocked: bool
    downstream_train: str | None
    junction_fault: bool
    junction_id: str | None
    current_signal_state: str | None


class SignalListResponse(BaseModel):
    """Schema for signal list response."""

    signals: list[SignalResponse]
    total: int
    green_count: int
    red_count: int
    yellow_count: int