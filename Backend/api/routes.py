"""
RailMind AI - Routes API Router.
Route planning, reservation, clearing, and conflict reporting.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from backend.schemas.route import (
    RouteCreate,
    RouteResponse,
    RoutePathRequest,
    RoutePathResponse,
    RouteReservationRequest,
    RouteReservationResponse,
    RouteConflictReport,
)
from backend.services.routing_service import RoutingService
from backend.graph.route_queries import create_route, get_route_by_id
from backend.core.logger import get_logger

logger = get_logger("api.routes")
router = APIRouter(prefix="/routes", tags=["Routes"])


def get_routing_service() -> RoutingService:
    return RoutingService()


@router.post("", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
async def create_route_endpoint(route: RouteCreate) -> dict[str, Any]:
    """Create a new route definition."""
    existing = await get_route_by_id(route.route_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Route {route.route_id} already exists",
        )

    result = await create_route(
        route_id=route.route_id,
        name=route.name,
        route_type=route.route_type,
        priority=route.priority,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create route",
        )
    logger.info("route_created", route_id=route.route_id)
    return result


@router.get("/{route_id}", response_model=RouteResponse)
async def get_route(route_id: str) -> dict[str, Any]:
    """Retrieve a route by ID."""
    route = await get_route_by_id(route_id)
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route {route_id} not found",
        )
    return route


@router.post("/plan", response_model=RoutePathResponse)
async def plan_route(
    request: RoutePathRequest,
    service: RoutingService = Depends(get_routing_service),
) -> dict[str, Any]:
    """Plan a route between two track segments."""
    try:
        result = await service.plan_route(
            train_number=request.train_number,
            start_track_id=request.start_track_id,
            end_track_id=request.end_track_id,
            min_speed_limit=request.min_speed_limit,
        )
        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post("/reserve", response_model=RouteReservationResponse)
async def reserve_route_endpoint(
    request: RouteReservationRequest,
    service: RoutingService = Depends(get_routing_service),
) -> dict[str, Any]:
    """Reserve a route for a train."""
    result = await service.reserve_route_for_train(
        route_id=request.route_id,
        train_number=request.train_number,
        track_sequence=request.track_sequence,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Failed to reserve route {request.route_id}",
        )
    logger.info("route_reserved_via_api", route_id=request.route_id, train=request.train_number)
    return result


@router.post("/{route_id}/clear", response_model=dict[str, Any])
async def clear_route(
    route_id: str,
    train_number: str,
    service: RoutingService = Depends(get_routing_service),
) -> dict[str, Any]:
    """Clear a reserved route."""
    result = await service.clear_route(train_number=train_number)
    return result


@router.get("/{route_id}/conflicts", response_model=RouteConflictReport)
async def get_route_conflicts(
    route_id: str,
    service: RoutingService = Depends(get_routing_service),
) -> dict[str, Any]:
    """Get conflict report for a route."""
    return await service.get_route_conflicts_report(route_id)