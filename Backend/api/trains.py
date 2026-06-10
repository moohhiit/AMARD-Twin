"""
RailMind AI - Trains API Router.
CRUD operations, position updates, and full graph retrieval for trains.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from backend.schemas.train import (
    TrainCreate,
    TrainUpdate,
    TrainResponse,
    TrainPositionUpdate,
    TrainListResponse,
    TrainFullGraph,
)
from backend.graph.train_queries import (
    create_train,
    get_train_by_number,
    get_all_trains,
    update_train_position,
    delete_train,
    get_train_full_graph,
)
from backend.core.logger import get_logger

logger = get_logger("api.trains")
router = APIRouter(prefix="/trains", tags=["Trains"])


@router.post("", response_model=TrainResponse, status_code=status.HTTP_201_CREATED)
async def create_train_endpoint(train: TrainCreate) -> dict[str, Any]:
    """Create a new train in the network."""
    existing = await get_train_by_number(train.train_number)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Train {train.train_number} already exists",
        )

    result = await create_train(
        train_number=train.train_number,
        name=train.name,
        status=train.status,
        speed=train.speed,
        direction=train.direction,
        current_track=train.current_track,
        next_track=train.next_track,
        route_id=train.route_id,
        progress_on_track=train.progress_on_track,
        train_length_m=train.train_length_m,
        current_platform=train.current_platform,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create train",
        )
    logger.info("train_created", train_number=train.train_number)
    return result


@router.get("", response_model=TrainListResponse)
async def list_trains() -> dict[str, Any]:
    """Retrieve all trains in the network."""
    trains = await get_all_trains()
    return {
        "trains": trains,
        "total": len(trains),
        "page": 1,
        "page_size": len(trains),
    }


@router.get("/{train_number}", response_model=TrainResponse)
async def get_train(train_number: str) -> dict[str, Any]:
    """Retrieve a specific train by its number."""
    train = await get_train_by_number(train_number)
    if not train:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train {train_number} not found",
        )
    return train


@router.patch("/{train_number}", response_model=TrainResponse)
async def update_train(train_number: str, update: TrainUpdate) -> dict[str, Any]:
    """Update train properties."""
    existing = await get_train_by_number(train_number)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train {train_number} not found",
        )

    updated = await update_train_position(
        train_number=train_number,
        current_track=update.current_track or existing.get("current_track", "UNKNOWN"),
        next_track=update.next_track,
        progress_on_track=update.progress_on_track or existing.get("progress_on_track", 0.0),
        speed=update.speed or existing.get("speed", 0.0),
        status=update.status or existing.get("status", "MOVING"),
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update train",
        )
    logger.info("train_updated", train_number=train_number)
    return updated


@router.post("/{train_number}/position", response_model=TrainResponse)
async def update_train_position_endpoint(
    train_number: str, position: TrainPositionUpdate
) -> dict[str, Any]:
    """Update a train's position, speed, and track."""
    if position.train_number != train_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Train number in path and body must match",
        )

    existing = await get_train_by_number(train_number)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train {train_number} not found",
        )

    updated = await update_train_position(
        train_number=train_number,
        current_track=position.current_track,
        next_track=position.next_track,
        progress_on_track=position.progress_on_track,
        speed=position.speed,
        status=position.status,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update position",
        )
    logger.info("train_position_updated", train_number=train_number, track=position.current_track)
    return updated


@router.get("/{train_number}/graph", response_model=TrainFullGraph)
async def get_train_graph(train_number: str) -> dict[str, Any]:
    """Retrieve a train with all connected graph nodes."""
    graph = await get_train_full_graph(train_number)
    if not graph:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train {train_number} not found",
        )
    return graph


@router.delete("/{train_number}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_train_endpoint(train_number: str) -> None:
    """Delete a train from the network."""
    existing = await get_train_by_number(train_number)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train {train_number} not found",
        )

    await delete_train(train_number)
    logger.info("train_deleted", train_number=train_number)