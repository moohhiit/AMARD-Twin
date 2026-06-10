"""
RailMind AI - Routing Service.
High-level orchestration for route planning, platform allocation, and signal coordination.
"""

from typing import Any

from backend.graph.route_queries import (
    find_shortest_valid_route,
    find_all_paths_with_junctions,
    reserve_route,
    clear_route_reservation,
    get_route_by_id,
    get_route_conflicts,
)
from backend.graph.platform_queries import (
    find_best_platform_for_train,
    assign_platform_to_train,
    release_platform,
    get_free_platforms_at_station,
)
from backend.graph.signal_queries import (
    get_signals_for_track,
    update_signal_state,
    check_track_safety_for_signal,
)
from backend.graph.train_queries import get_train_by_number, update_train_position
from backend.event_bus.event_manager import event_manager
from backend.event_bus.events import EventType
from backend.core.logger import get_logger

logger = get_logger("routing_service")


class RoutingService:
    """Service for route planning, platform allocation, and signal coordination."""

    def __init__(self) -> None:
        self._event_manager = event_manager

    async def plan_route(
        self,
        train_number: str,
        start_track_id: str,
        end_track_id: str,
        min_speed_limit: float = 0.0,
        max_hops: int = 10,
    ) -> dict[str, Any]:
        """Plan a route for a train and return path options."""
        train = await get_train_by_number(train_number)
        if not train:
            raise ValueError(f"Train {train_number} not found")

        shortest = await find_shortest_valid_route(
            start_track_id, end_track_id, min_speed_limit
        )
        alternatives = await find_all_paths_with_junctions(
            start_track_id, end_track_id, max_hops
        )

        return {
            "train_number": train_number,
            "shortest_path": shortest[0] if shortest else None,
            "alternatives": alternatives[:3],
            "requested": {
                "start": start_track_id,
                "end": end_track_id,
                "min_speed": min_speed_limit,
            },
        }

    async def allocate_platform(
        self,
        train_number: str,
        station_id: str,
    ) -> dict[str, Any]:
        """Allocate the best available platform to a train."""
        train = await get_train_by_number(train_number)
        if not train:
            raise ValueError(f"Train {train_number} not found")

        platform = await find_best_platform_for_train(train_number, station_id)
        if not platform:
            free = await get_free_platforms_at_station(
                station_id, train.get("train_length_m", 0)
            )
            return {
                "success": False,
                "train_number": train_number,
                "station_id": station_id,
                "reason": "no_suitable_platform",
                "available_platforms": len(free),
            }

        assigned = await assign_platform_to_train(
            train_number, platform["platform_id"]
        )
        if assigned:
            await self._event_manager.publisher.publish(
                EventType.PLATFORM_ASSIGNED,
                "RoutingService",
                {
                    "train_number": train_number,
                    "platform_id": platform["platform_id"],
                    "station_id": station_id,
                    "assignment_reason": "service_request",
                },
            )
            return {
                "success": True,
                "train_number": train_number,
                "platform": platform,
            }

        return {
            "success": False,
            "train_number": train_number,
            "reason": "assignment_failed",
        }

    async def release_platform_assignment(
        self,
        platform_id: str,
    ) -> dict[str, Any]:
        """Release a platform from its current train."""
        result = await release_platform(platform_id)
        return {
            "success": result is not None,
            "platform_id": platform_id,
            "platform": result,
        }

    async def coordinate_signals_for_track(
        self,
        track_id: str,
        requesting_train_number: str,
    ) -> dict[str, Any]:
        """Evaluate and set signals for a track based on safety checks."""
        safety = await check_track_safety_for_signal(
            track_id, requesting_train_number
        )
        signals = await get_signals_for_track(track_id)

        if safety.get("is_clear"):
            for sig in signals:
                if sig.get("state") != "GREEN":
                    await update_signal_state(sig["signal_id"], "GREEN")
            return {
                "track_id": track_id,
                "safe": True,
                "signals": [s["signal_id"] for s in signals],
                "state": "GREEN",
            }

        for sig in signals:
            if sig.get("state") != "RED":
                await update_signal_state(sig["signal_id"], "RED")
        return {
            "track_id": track_id,
            "safe": False,
            "reason": self._derive_reason(safety),
            "signals": [s["signal_id"] for s in signals],
            "state": "RED",
        }

    async def reserve_route_for_train(
        self,
        route_id: str,
        train_number: str,
        track_sequence: list[str],
    ) -> dict[str, Any]:
        """Atomically reserve a route for a train."""
        reserved = await reserve_route(route_id, train_number, track_sequence)
        if reserved:
            await self._event_manager.publisher.publish(
                EventType.ROUTE_ASSIGNED,
                "RoutingService",
                {
                    "train_number": train_number,
                    "route_id": route_id,
                    "track_sequence": track_sequence,
                },
            )
        return {
            "success": reserved,
            "route_id": route_id,
            "train_number": train_number,
            "track_sequence": track_sequence,
        }

    async def clear_route(
        self,
        train_number: str,
    ) -> dict[str, Any]:
        """Clear a train's reserved route."""
        await clear_route_reservation(train_number)
        await self._event_manager.publisher.publish(
            EventType.ROUTE_CLEAR,
            "RoutingService",
            {
                "train_number": train_number,
                "clear_reason": "service_request",
            },
        )
        return {
            "success": True,
            "train_number": train_number,
        }

    async def get_route_conflicts_report(
        self,
        route_id: str,
    ) -> dict[str, Any]:
        """Get conflict report for a specific route."""
        route = await get_route_by_id(route_id)
        conflicts = await get_route_conflicts(route_id)
        return {
            "route_id": route_id,
            "route_exists": route is not None,
            "conflicts": conflicts,
            "conflict_count": len(conflicts),
        }

    def _derive_reason(self, safety: dict[str, Any]) -> str:
        if safety.get("is_occupied"):
            return "track_occupied"
        if safety.get("under_maintenance"):
            return "maintenance"
        if safety.get("downstream_blocked"):
            return "downstream_blocked"
        if safety.get("junction_fault"):
            return "junction_fault"
        return "safety_check_failed"