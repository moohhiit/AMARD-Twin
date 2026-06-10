"""
RailMind AI - Platforms API Router.
Platform listing, allocation, and release operations.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from backend.schemas.platform import (
    PlatformCreate,
    PlatformResponse,
    PlatformAllocationRequest,
    PlatformAllocationResponse,
    PlatformReleaseRequest,
    PlatformListResponse,
)
from backend.services.routing_service import RoutingService
from backend.graph.platform_queries import (
    get_platform_by_id,
    get_all_platforms,
    create_platform,
)
from backend.core.logger import get_logger

logger = get_logger("api.platforms")
router = APIRouter(prefix="/platforms", tags=["Platforms"])


def get_routing_service() -> RoutingService:
    return RoutingService()


@router.post("", response_model=PlatformResponse, status_code=status.HTTP_201_CREATED)
async def create_platform_endpoint(platform: PlatformCreate) -> dict[str, Any]:
    """Create a new platform."""
    existing = await get_platform_by_id(platform.platform_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Platform {platform.platform_id} already exists",
        )

    result = await create_platform(
        platform_id=platform.platform_id,
        platform_number=platform.platform_number,
        name=platform.name,
        status=platform.status,
        length_m=platform.length_m,
        station_id=platform.station_id,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create platform",
        )
    logger.info("platform_created", platform_id=platform.platform_id)
    return result


@router.get("", response_model=PlatformListResponse)
async def list_platforms(station_id: str | None = None) -> dict[str, Any]:
    """Retrieve all platforms, optionally filtered by station."""
    platforms = await get_all_platforms()
    if station_id:
        platforms = [p for p in platforms if p.get("station_id") == station_id]
    return {
        "platforms": platforms,
        "total": len(platforms),
        "station_id": station_id,
    }


@router.get("/{platform_id}", response_model=PlatformResponse)
async def get_platform(platform_id: str) -> dict[str, Any]:
    """Retrieve a specific platform."""
    platform = await get_platform_by_id(platform_id)
    if not platform:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Platform {platform_id} not found",
        )
    return platform


@router.post("/allocate", response_model=PlatformAllocationResponse)
async def allocate_platform(
    request: PlatformAllocationRequest,
    service: RoutingService = Depends(get_routing_service),
) -> dict[str, Any]:
    """Allocate the best platform to a train."""
    result = await service.allocate_platform(
        train_number=request.train_number,
        station_id=request.station_id,
    )
    return result


@router.post("/release", response_model=dict[str, Any])
async def release_platform_endpoint(
    request: PlatformReleaseRequest,
    service: RoutingService = Depends(get_routing_service),
) -> dict[str, Any]:
    """Release a platform from its current train."""
    result = await service.release_platform_assignment(request.platform_id)
    return result