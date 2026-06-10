"""
RailMind AI - Signals API Router.
Signal state management and safety checks.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from backend.schemas.signal import (
    SignalCreate,
    SignalUpdate,
    SignalResponse,
    SignalSafetyRequest,
    SignalSafetyResponse,
    SignalListResponse,
)
from backend.services.routing_service import RoutingService
from backend.graph.signal_queries import (
    get_signal_by_id,
    get_all_signals,
    update_signal_state,
    check_track_safety_for_signal,
)
from backend.core.logger import get_logger

logger = get_logger("api.signals")
router = APIRouter(prefix="/signals", tags=["Signals"])


def get_routing_service() -> RoutingService:
    return RoutingService()


@router.post("", response_model=SignalResponse, status_code=status.HTTP_201_CREATED)
async def create_signal_endpoint(signal: SignalCreate) -> dict[str, Any]:
    """Create a new signal."""
    existing = await get_signal_by_id(signal.signal_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Signal {signal.signal_id} already exists",
        )

    query = """
    CREATE (sig:Signal {
        signal_id: $signal_id,
        state: $state,
        controlled_track: $controlled_track,
        last_changed: datetime()
    })
    WITH sig
    MATCH (tr:TrackSegment {track_id: $controlled_track})
    CREATE (tr)-[:PROTECTED_BY]->(sig)
    RETURN sig {
        .*,
        last_changed: toString(sig.last_changed),
        protected_track: tr.track_id
    } AS signal
    """
    params = {
        "signal_id": signal.signal_id,
        "state": signal.state,
        "controlled_track": signal.controlled_track,
    }
    from backend.graph.neo4j_client import neo4j_manager
    result = await neo4j_manager.execute_write(query, params)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create signal",
        )
    logger.info("signal_created", signal_id=signal.signal_id)
    return result[0]["signal"]


@router.get("", response_model=SignalListResponse)
async def list_signals() -> dict[str, Any]:
    """Retrieve all signals."""
    signals = await get_all_signals()
    green = sum(1 for s in signals if s.get("state") == "GREEN")
    red = sum(1 for s in signals if s.get("state") == "RED")
    yellow = sum(1 for s in signals if s.get("state") == "YELLOW")
    return {
        "signals": signals,
        "total": len(signals),
        "green_count": green,
        "red_count": red,
        "yellow_count": yellow,
    }


@router.get("/{signal_id}", response_model=SignalResponse)
async def get_signal(signal_id: str) -> dict[str, Any]:
    """Retrieve a specific signal."""
    signal = await get_signal_by_id(signal_id)
    if not signal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Signal {signal_id} not found",
        )
    return signal


@router.patch("/{signal_id}", response_model=SignalResponse)
async def update_signal(signal_id: str, update: SignalUpdate) -> dict[str, Any]:
    """Update a signal's state."""
    existing = await get_signal_by_id(signal_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Signal {signal_id} not found",
        )

    updated = await update_signal_state(signal_id, update.state)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update signal",
        )
    logger.info("signal_updated", signal_id=signal_id, state=update.state)
    return updated


@router.post("/safety-check", response_model=SignalSafetyResponse)
async def signal_safety_check(
    request: SignalSafetyRequest,
    service: RoutingService = Depends(get_routing_service),
) -> dict[str, Any]:
    """Perform a safety check for a track and return signal coordination advice."""
    result = await service.coordinate_signals_for_track(
        track_id=request.track_id,
        requesting_train_number=request.requesting_train_number,
    )
    safety = await check_track_safety_for_signal(
        request.track_id, request.requesting_train_number
    )
    return {
        "track_id": request.track_id,
        "is_clear": safety.get("is_clear", False),
        "is_occupied": safety.get("is_occupied", False),
        "occupant_train": safety.get("occupant_train"),
        "under_maintenance": safety.get("under_maintenance", False),
        "maintenance_block": safety.get("maintenance_block"),
        "downstream_blocked": safety.get("downstream_blocked", False),
        "downstream_train": safety.get("downstream_train"),
        "junction_fault": safety.get("junction_fault", False),
        "junction_id": safety.get("junction_id"),
        "current_signal_state": safety.get("current_signal_state"),
    }