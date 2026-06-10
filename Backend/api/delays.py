"""
RailMind AI - Delays API Router.
Delay prediction, analysis, and reporting endpoints.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from backend.services.prediction_service import PredictionService
from backend.services.dispatch_service import DispatchService
from backend.graph.train_queries import get_train_by_number
from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("api.delays")
router = APIRouter(prefix="/delays", tags=["Delays"])


def get_prediction_service() -> PredictionService:
    return PredictionService()


def get_dispatch_service() -> DispatchService:
    return DispatchService()


@router.get("/predict/{train_number}", response_model=dict[str, Any])
async def predict_delays(
    train_number: str,
    lookahead: int = 5,
    service: PredictionService = Depends(get_prediction_service),
) -> dict[str, Any]:
    """Predict downstream delays for a train."""
    try:
        result = await service.predict_delays(train_number, lookahead)
        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/congestion", response_model=dict[str, Any])
async def estimate_congestion(
    zone_id: str | None = None,
    service: PredictionService = Depends(get_prediction_service),
) -> dict[str, Any]:
    """Estimate congestion levels across the network or a specific zone."""
    return await service.estimate_congestion(zone_id)


@router.get("/eta/{train_number}", response_model=dict[str, Any])
async def get_eta(
    train_number: str,
    destination_track_id: str,
    service: PredictionService = Depends(get_prediction_service),
) -> dict[str, Any]:
    """Calculate estimated time of arrival for a train."""
    try:
        return await service.get_eta(train_number, destination_track_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/report", response_model=dict[str, Any])
async def get_delay_report() -> dict[str, Any]:
    """Get a comprehensive delay report for all trains."""
    query = """
    MATCH (t:Train)
    WHERE t.status = 'DELAYED' OR t.delay_minutes > 0
    OPTIONAL MATCH (t)-[:CURRENTLY_ON]->(tr:TrackSegment)
    OPTIONAL MATCH (e:Event)-[:INVOLVES]->(t)
    WHERE e.event_type = 'TRAIN_DELAYED'
    RETURN t.train_number AS train_number,
           t.name AS name,
           t.status AS status,
           t.speed AS speed,
           t.delay_minutes AS delay_minutes,
           tr.track_id AS current_track,
           count(e) AS delay_event_count,
           collect(DISTINCT e.location)[0..5] AS affected_locations
    ORDER BY t.delay_minutes DESC
    """
    result = await neo4j_manager.execute_read(query)
    trains = [
        {
            "train_number": r["train_number"],
            "name": r["name"],
            "status": r["status"],
            "speed": r["speed"],
            "delay_minutes": r["delay_minutes"],
            "current_track": r["current_track"],
            "delay_event_count": r["delay_event_count"],
            "affected_locations": r["affected_locations"],
        }
        for r in result
    ]
    total_delay = sum(t["delay_minutes"] or 0 for t in trains)
    return {
        "delayed_trains": trains,
        "total_delayed": len(trains),
        "total_delay_minutes": round(total_delay, 1),
        "average_delay_minutes": round(total_delay / len(trains), 1) if trains else 0,
    }


@router.post("/hold/{train_number}", response_model=dict[str, Any])
async def hold_train(
    train_number: str,
    reason: str = "api_hold",
    service: DispatchService = Depends(get_dispatch_service),
) -> dict[str, Any]:
    """Hold a train at its current position."""
    result = await service.hold_train(train_number, reason)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train {train_number} not found",
        )
    logger.info("train_held_via_api", train_number=train_number, reason=reason)
    return result