"""
RailMind AI - Conflicts API Router.
Conflict detection and reporting endpoints.
"""

from typing import Any

from fastapi import APIRouter, HTTPException, status

from backend.graph.conflict_queries import (
    detect_track_occupancy_conflicts,
    detect_route_conflicts,
    detect_junction_conflicts,
    detect_headway_conflicts,
    get_all_active_conflicts,
    get_conflict_history_for_train,
)
from backend.core.logger import get_logger

logger = get_logger("api.conflicts")
router = APIRouter(prefix="/conflicts", tags=["Conflicts"])


@router.get("/active", response_model=dict[str, Any])
async def get_active_conflicts() -> dict[str, Any]:
    """Retrieve all currently active conflicts in the network."""
    conflicts = await get_all_active_conflicts()
    return {
        "conflicts": conflicts,
        "count": len(conflicts),
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }


@router.get("/track-occupancy", response_model=dict[str, Any])
async def get_track_occupancy_conflicts() -> dict[str, Any]:
    """Detect track occupancy conflicts (multiple trains on same track)."""
    conflicts = await detect_track_occupancy_conflicts()
    return {
        "conflict_type": "TRACK_OCCUPANCY",
        "conflicts": conflicts,
        "count": len(conflicts),
    }


@router.get("/route-overlap", response_model=dict[str, Any])
async def get_route_conflicts() -> dict[str, Any]:
    """Detect route overlap conflicts."""
    conflicts = await detect_route_conflicts()
    return {
        "conflict_type": "ROUTE_OVERLAP",
        "conflicts": conflicts,
        "count": len(conflicts),
    }


@router.get("/junction", response_model=dict[str, Any])
async def get_junction_conflicts() -> dict[str, Any]:
    """Detect junction conflicts."""
    conflicts = await detect_junction_conflicts()
    return {
        "conflict_type": "JUNCTION_CONFLICT",
        "conflicts": conflicts,
        "count": len(conflicts),
    }


@router.get("/headway", response_model=dict[str, Any])
async def get_headway_conflicts(min_distance_km: float = 1.0) -> dict[str, Any]:
    """Detect headway violations."""
    conflicts = await detect_headway_conflicts(min_distance_km)
    return {
        "conflict_type": "HEADWAY_VIOLATION",
        "min_distance_km": min_distance_km,
        "conflicts": conflicts,
        "count": len(conflicts),
    }


@router.get("/history/{train_number}", response_model=dict[str, Any])
async def get_conflict_history(
    train_number: str,
    limit: int = 50,
) -> dict[str, Any]:
    """Retrieve conflict history for a specific train."""
    events = await get_conflict_history_for_train(train_number, limit)
    return {
        "train_number": train_number,
        "events": events,
        "count": len(events),
    }