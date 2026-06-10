"""
RailMind AI - Dispatch Service.
Train dispatch operations, movement authority, and queue management.
"""

from typing import Any

from backend.graph.train_queries import (
    get_train_by_number,
    update_train_position,
    get_all_trains,
)
from backend.graph.route_queries import (
    get_route_by_id,
    clear_route_reservation,
)
from backend.graph.signal_queries import get_signals_for_track
from backend.event_bus.event_manager import event_manager
from backend.event_bus.events import EventType
from backend.core.logger import get_logger

logger = get_logger("dispatch_service")


class DispatchService:
    """Service for train dispatch and movement authority management."""

    def __init__(self) -> None:
        self._event_manager = event_manager

    async def dispatch_train(
        self,
        train_number: str,
        target_speed: float | None = None,
    ) -> dict[str, Any]:
        """Dispatch a train from its current position."""
        train = await get_train_by_number(train_number)
        if not train:
            raise ValueError(f"Train {train_number} not found")

        if train.get("status") == "STOPPED":
            new_speed = target_speed or 40.0
            updated = await update_train_position(
                train_number=train_number,
                current_track=train.get("current_track", "UNKNOWN"),
                next_track=train.get("next_track"),
                progress_on_track=train.get("progress_on_track", 0.0),
                speed=new_speed,
                status="MOVING",
            )
            await self._event_manager.publisher.publish(
                EventType.MOVEMENT_AUTHORITY_GRANTED,
                "DispatchService",
                {
                    "train_number": train_number,
                    "authority_type": "PROCEED",
                    "max_speed": new_speed,
                    "reason": "manual_dispatch",
                },
            )
            return {
                "success": True,
                "train_number": train_number,
                "previous_status": "STOPPED",
                "new_speed": new_speed,
                "train": updated,
            }

        return {
            "success": False,
            "train_number": train_number,
            "reason": "train_not_stopped",
            "current_status": train.get("status"),
        }

    async def hold_train(
        self,
        train_number: str,
        reason: str = "service_hold",
    ) -> dict[str, Any]:
        """Hold a train at its current position."""
        train = await get_train_by_number(train_number)
        if not train:
            raise ValueError(f"Train {train_number} not found")

        updated = await update_train_position(
            train_number=train_number,
            current_track=train.get("current_track", "UNKNOWN"),
            next_track=None,
            progress_on_track=train.get("progress_on_track", 0.0),
            speed=0.0,
            status="STOPPED",
        )
        await clear_route_reservation(train_number)
        await self._event_manager.publisher.publish(
            EventType.SIGNAL_RED,
            "DispatchService",
            {
                "train_number": train_number,
                "reason": reason,
                "location": train.get("current_track"),
            },
        )
        return {
            "success": True,
            "train_number": train_number,
            "status": "STOPPED",
            "reason": reason,
            "train": updated,
        }

    async def get_dispatch_queue(self) -> dict[str, Any]:
        """Get all trains eligible for dispatch."""
        trains = await get_all_trains()
        queue = []
        for train in trains:
            if train.get("status") in ("STOPPED", "WAITING"):
                signals = []
                if train.get("current_track_id"):
                    sigs = await get_signals_for_track(
                        train["current_track_id"]
                    )
                    signals = [s["state"] for s in sigs]

                queue.append(
                    {
                        "train_number": train.get("train_number"),
                        "name": train.get("name"),
                        "status": train.get("status"),
                        "current_track": train.get("current_track"),
                        "route_id": train.get("route_id"),
                        "signal_states": signals,
                        "dispatch_ready": "GREEN" in signals
                        if signals
                        else False,
                    }
                )

        queue.sort(
            key=lambda x: (
                x["dispatch_ready"],
                x.get("route_id") is not None,
            ),
            reverse=True,
        )

        return {
            "queue_length": len(queue),
            "dispatch_ready_count": sum(
                1 for q in queue if q["dispatch_ready"]
            ),
            "trains": queue,
        }

    async def grant_movement_authority(
        self,
        train_number: str,
        max_speed: float,
        until_track: str,
        distance_km: float,
    ) -> dict[str, Any]:
        """Grant explicit movement authority to a train."""
        train = await get_train_by_number(train_number)
        if not train:
            raise ValueError(f"Train {train_number} not found")

        await self._event_manager.publisher.publish(
            EventType.MOVEMENT_AUTHORITY_GRANTED,
            "DispatchService",
            {
                "train_number": train_number,
                "authority_type": "PROCEED",
                "max_speed": max_speed,
                "distance_km": distance_km,
                "until_track": until_track,
            },
        )
        return {
            "success": True,
            "train_number": train_number,
            "authority": {
                "type": "PROCEED",
                "max_speed": max_speed,
                "until_track": until_track,
                "distance_km": distance_km,
            },
        }