"""
RailMind AI - Event Schemas.
Pydantic v2 models for system event validation and serialization.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, ConfigDict

from backend.event_bus.events import EventType


class EventBase(BaseModel):
    """Base model for system events."""

    event_type: str = Field(..., description="Event type identifier")
    event_id: str = Field(..., min_length=1, max_length=100, description="Unique event identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")
    source_agent: str = Field(..., min_length=1, max_length=100, description="Source agent name")
    correlation_id: str | None = Field(default=None, max_length=100, description="Correlation ID")
    payload: dict[str, Any] = Field(default_factory=dict, description="Event payload")


class EventCreate(BaseModel):
    """Schema for creating a new event in the graph."""

    event_id: str = Field(..., min_length=1, max_length=100)
    event_type: str = Field(..., min_length=1, max_length=50)
    severity: str = Field(default="INFO", pattern="^(INFO|LOW|MEDIUM|HIGH|CRITICAL)$")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    resolved: bool = Field(default=False)
    source_train: str | None = Field(default=None, max_length=20)
    delay_minutes: float = Field(default=0.0, ge=0.0)
    location: str | None = Field(default=None, max_length=50)

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "event_id": "EVT_001",
            "event_type": "TRAIN_DELAYED",
            "severity": "HIGH",
            "resolved": False,
            "source_train": "T123",
            "delay_minutes": 10.0,
            "location": "TRK_002",
        }
    })


class EventResponse(EventBase):
    """Schema for event response."""

    severity: str | None = Field(default=None)
    resolved: bool | None = Field(default=None)
    source_train: str | None = Field(default=None)
    delay_minutes: float | None = Field(default=None)
    location: str | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)


class EventFilterRequest(BaseModel):
    """Schema for event filtering."""

    event_type: EventType | None = Field(default=None)
    severity: str | None = Field(default=None, pattern="^(INFO|LOW|MEDIUM|HIGH|CRITICAL)$")
    source_agent: str | None = Field(default=None, max_length=100)
    source_train: str | None = Field(default=None, max_length=20)
    resolved: bool | None = Field(default=None)
    start_time: datetime | None = Field(default=None)
    end_time: datetime | None = Field(default=None)
    limit: int = Field(default=50, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "severity": "HIGH",
            "limit": 50,
            "offset": 0,
        }
    })


class EventListResponse(BaseModel):
    """Schema for paginated event list response."""

    events: list[EventResponse]
    total: int
    limit: int
    offset: int


class EventStatsResponse(BaseModel):
    """Schema for event statistics."""

    total_events: int
    by_type: dict[str, int]
    by_severity: dict[str, int]
    unresolved_count: int
    average_delay_minutes: float