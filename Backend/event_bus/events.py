"""
RailMind AI - Event Definitions.
Pydantic v2 models for all event bus messages with strict typing.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Enumeration of all event types in the RailMind AI system."""

    TRAIN_APPROACHING = "TRAIN_APPROACHING"
    PLATFORM_ASSIGNED = "PLATFORM_ASSIGNED"
    ROUTE_ASSIGNED = "ROUTE_ASSIGNED"
    ROUTE_CLEAR = "ROUTE_CLEAR"
    ROUTE_CONFLICT = "ROUTE_CONFLICT"
    SIGNAL_GREEN = "SIGNAL_GREEN"
    SIGNAL_RED = "SIGNAL_RED"
    TRAIN_DELAYED = "TRAIN_DELAYED"
    MAINTENANCE_REQUIRED = "MAINTENANCE_REQUIRED"
    EMERGENCY_TRIGGERED = "EMERGENCY_TRIGGERED"
    MOVEMENT_AUTHORITY_GRANTED = "MOVEMENT_AUTHORITY_GRANTED"


class BaseEvent(BaseModel):
    """Base model for all events with common metadata."""

    event_type: EventType
    event_id: str = Field(description="Unique event identifier (UUID)")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source_agent: str = Field(description="Name of the agent that emitted the event")
    correlation_id: str | None = Field(default=None, description="Tracing correlation ID")
    payload: dict[str, Any] = Field(default_factory=dict, description="Event-specific data")

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class TrainApproachingEvent(BaseEvent):
    """Emitted when a train is approaching a station or junction."""

    event_type: Literal[EventType.TRAIN_APPROACHING] = EventType.TRAIN_APPROACHING
    payload: dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={
            "example": {
                "train_number": "T123",
                "station_id": "STN_001",
                "distance_km": 2.5,
                "estimated_arrival_minutes": 3,
            }
        },
    )


class PlatformAssignedEvent(BaseEvent):
    """Emitted when a platform is allocated to a train."""

    event_type: Literal[EventType.PLATFORM_ASSIGNED] = EventType.PLATFORM_ASSIGNED
    payload: dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={
            "example": {
                "train_number": "T123",
                "platform_id": "PLT_001_A",
                "station_id": "STN_001",
                "assignment_reason": "length_match",
            }
        },
    )


class RouteAssignedEvent(BaseEvent):
    """Emitted when a route is reserved for a train."""

    event_type: Literal[EventType.ROUTE_ASSIGNED] = EventType.ROUTE_ASSIGNED
    payload: dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={
            "example": {
                "train_number": "T123",
                "route_id": "RTE_001",
                "track_sequence": ["TRK_01", "TRK_02", "TRK_03"],
                "estimated_duration_minutes": 15,
            }
        },
    )


class RouteClearEvent(BaseEvent):
    """Emitted when a previously reserved route is cleared."""

    event_type: Literal[EventType.ROUTE_CLEAR] = EventType.ROUTE_CLEAR
    payload: dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={
            "example": {
                "train_number": "T123",
                "route_id": "RTE_001",
                "clear_reason": "destination_reached",
            }
        },
    )


class RouteConflictEvent(BaseEvent):
    """Emitted when two or more routes overlap dangerously."""

    event_type: Literal[EventType.ROUTE_CONFLICT] = EventType.ROUTE_CONFLICT
    payload: dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={
            "example": {
                "conflict_type": "ROUTE_OVERLAP",
                "track_id": "TRK_02",
                "train_a": "T123",
                "train_b": "T456",
                "severity": "HIGH",
            }
        },
    )


class SignalGreenEvent(BaseEvent):
    """Emitted when a signal is set to GREEN."""

    event_type: Literal[EventType.SIGNAL_GREEN] = EventType.SIGNAL_GREEN
    payload: dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={
            "example": {
                "signal_id": "SIG_001",
                "track_id": "TRK_01",
                "train_number": "T123",
                "safety_check_passed": True,
            }
        },
    )


class SignalRedEvent(BaseEvent):
    """Emitted when a signal is set to RED."""

    event_type: Literal[EventType.SIGNAL_RED] = EventType.SIGNAL_RED
    payload: dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={
            "example": {
                "signal_id": "SIG_001",
                "track_id": "TRK_01",
                "reason": "track_occupied",
                "cascade": False,
            }
        },
    )


class TrainDelayedEvent(BaseEvent):
    """Emitted when a train is delayed."""

    event_type: Literal[EventType.TRAIN_DELAYED] = EventType.TRAIN_DELAYED
    payload: dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={
            "example": {
                "train_number": "T123",
                "delay_minutes": 10,
                "reason": "signal_stop",
                "location": "TRK_02",
                "estimated_cascade_impact": 3,
            }
        },
    )


class MaintenanceRequiredEvent(BaseEvent):
    """Emitted when maintenance is detected or scheduled."""

    event_type: Literal[EventType.MAINTENANCE_REQUIRED] = EventType.MAINTENANCE_REQUIRED
    payload: dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={
            "example": {
                "block_id": "MB_001",
                "track_ids": ["TRK_05"],
                "reason": "scheduled_inspection",
                "urgency": "PLANNED",
            }
        },
    )


class EmergencyTriggeredEvent(BaseEvent):
    """Emitted when an emergency situation is detected."""

    event_type: Literal[EventType.EMERGENCY_TRIGGERED] = EventType.EMERGENCY_TRIGGERED
    payload: dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={
            "example": {
                "emergency_type": "TRACK_FAILURE",
                "location": "TRK_07",
                "affected_trains": ["T123", "T456"],
                "immediate_action": "STOP_ALL",
            }
        },
    )


class MovementAuthorityGrantedEvent(BaseEvent):
    """Emitted when a train receives movement authority."""

    event_type: Literal[EventType.MOVEMENT_AUTHORITY_GRANTED] = EventType.MOVEMENT_AUTHORITY_GRANTED
    payload: dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={
            "example": {
                "train_number": "T123",
                "authority_type": "PROCEED",
                "max_speed": 80,
                "distance_km": 5.2,
                "until_track": "TRK_05",
            }
        },
    )


EventUnion = (
    TrainApproachingEvent
    | PlatformAssignedEvent
    | RouteAssignedEvent
    | RouteClearEvent
    | RouteConflictEvent
    | SignalGreenEvent
    | SignalRedEvent
    | TrainDelayedEvent
    | MaintenanceRequiredEvent
    | EmergencyTriggeredEvent
    | MovementAuthorityGrantedEvent
)