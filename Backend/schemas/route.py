"""
RailMind AI - Route Schemas.
Pydantic v2 models for route data validation and serialization.
"""

from typing import Any

from pydantic import BaseModel, Field, ConfigDict


class RouteBase(BaseModel):
    """Base model for route properties."""

    route_id: str = Field(..., min_length=1, max_length=50, description="Unique route identifier")
    name: str = Field(..., min_length=1, max_length=100, description="Route name")
    route_type: str = Field(default="STANDARD", pattern="^(STANDARD|EXPRESS|FREIGHT|LOOP|DIVERSION)$")
    priority: int = Field(default=1, ge=1, le=100, description="Route priority level")


class RouteCreate(RouteBase):
    """Schema for creating a new route."""

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "route_id": "RTE_001",
            "name": "Main Line North",
            "route_type": "STANDARD",
            "priority": 5,
        }
    })


class RouteResponse(RouteBase):
    """Schema for route response."""

    model_config = ConfigDict(from_attributes=True)


class RoutePathRequest(BaseModel):
    """Schema for route path planning request."""

    train_number: str = Field(..., min_length=1, max_length=20)
    start_track_id: str = Field(..., min_length=1, max_length=50)
    end_track_id: str = Field(..., min_length=1, max_length=50)
    min_speed_limit: float = Field(default=0.0, ge=0.0, le=300.0)

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "train_number": "T123",
            "start_track_id": "TRK_001",
            "end_track_id": "TRK_010",
            "min_speed_limit": 60.0,
        }
    })


class RoutePathResponse(BaseModel):
    """Schema for route path planning response."""

    train_number: str
    shortest_path: dict[str, Any] | None
    alternatives: list[dict[str, Any]]
    requested: dict[str, Any]


class RouteReservationRequest(BaseModel):
    """Schema for route reservation request."""

    route_id: str = Field(..., min_length=1, max_length=50)
    train_number: str = Field(..., min_length=1, max_length=20)
    track_sequence: list[str] = Field(..., min_length=1)

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "route_id": "RTE_001",
            "train_number": "T123",
            "track_sequence": ["TRK_001", "TRK_002", "TRK_003"],
        }
    })


class RouteReservationResponse(BaseModel):
    """Schema for route reservation response."""

    success: bool
    route_id: str
    train_number: str
    track_sequence: list[str]


class RouteConflictReport(BaseModel):
    """Schema for route conflict report."""

    route_id: str
    route_exists: bool
    conflicts: list[dict[str, Any]]
    conflict_count: int