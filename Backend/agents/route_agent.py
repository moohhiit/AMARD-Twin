"""
RailMind AI - RouteAllocationAgent.
Finds shortest valid routes, configures junctions, and reserves paths.
"""

import asyncio
from typing import Any

from backend.agents.base_agent import BaseAgent
from backend.event_bus.events import EventType, BaseEvent
from backend.graph.route_queries import (
    find_shortest_valid_route,
    reserve_route,
    configure_junction_for_route,
)
from backend.graph.train_queries import get_train_by_number, update_train_route
from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("route_agent")


class RouteAllocationAgent(BaseAgent):
    """Agent responsible for route search, reservation, and junction configuration."""

    def __init__(self) -> None:
        super().__init__("RouteAllocationAgent")

    async def _register_handlers(self) -> None:
        self.subscribe(EventType.PLATFORM_ASSIGNED, self._on_platform_assigned)
        self.subscribe(EventType.TRAIN_APPROACHING, self._on_train_approaching)

    async def _run_loop(self) -> None:
        while self._running:
            await asyncio.sleep(5.0)

    async def handle_event(self, event: BaseEvent) -> None:
        pass

    async def _on_platform_assigned(self, event: BaseEvent) -> None:
        await self._allocate_route(event)

    async def _on_train_approaching(self, event: BaseEvent) -> None:
        if event.payload.get("requires_route"):
            await self._allocate_route(event)

    async def _allocate_route(self, event: BaseEvent) -> None:
        payload = event.payload
        train_number = payload.get("train_number")
        if not train_number:
            return

        train = await get_train_by_number(train_number)
        if not train:
            return

        current_track = train.get("current_track")
        next_track = payload.get("target_track") or train.get("next_track")
        if not current_track or not next_track:
            self._logger.warning(
                "route_allocation_missing_tracks",
                train_number=train_number,
                current=current_track,
                next=next_track,
            )
            return

        route_options = await find_shortest_valid_route(
            current_track,
            next_track,
            min_speed_limit=train.get("speed", 0),
        )
        if not route_options:
            self._logger.warning(
                "no_valid_route_found",
                train_number=train_number,
                from_track=current_track,
                to_track=next_track,
            )
            return

        best_route = route_options[0]
        track_sequence = best_route["track_sequence"]
        route_id = f"RTE_{train_number}_{event.event_id[:8]}"

        reserved = await reserve_route(route_id, train_number, track_sequence)
        if not reserved:
            self._logger.error(
                "route_reservation_failed",
                train_number=train_number,
                route_id=route_id,
            )
            return

        await update_train_route(train_number, route_id)
        await self._configure_junctions_for_path(track_sequence)

        await self.publish(
            EventType.ROUTE_ASSIGNED,
            {
                "train_number": train_number,
                "route_id": route_id,
                "track_sequence": track_sequence,
                "total_distance_km": best_route["total_distance"],
                "hop_count": best_route["hop_count"],
                "estimated_duration_minutes": self._estimate_duration(
                    best_route, train.get("speed", 0)
                ),
            },
            correlation_id=event.correlation_id or event.event_id,
        )
        self._logger.info(
            "route_assigned",
            train_number=train_number,
            route_id=route_id,
            tracks=track_sequence,
        )

    def _estimate_duration(self, route: dict[str, Any], speed: float) -> float:
        if speed <= 0:
            return 999.0
        return round(route["total_distance"] / speed * 60.0, 2)

    async def _configure_junctions_for_path(
        self, track_sequence: list[str]
    ) -> None:
        if len(track_sequence) < 2:
            return
        for i in range(len(track_sequence) - 1):
            entry = track_sequence[i]
            exit_ = track_sequence[i + 1]
            query = """
            MATCH (j:Junction)-[:CONNECTS]->(entry:TrackSegment {track_id: $entry})
            MATCH (j)-[:CONNECTS]->(exit:TrackSegment {track_id: $exit})
            RETURN j.junction_id AS junction_id
            LIMIT 1
            """
            result = await neo4j_manager.execute_read(
                query, {"entry": entry, "exit": exit_}
            )
            if result:
                j_id = result[0]["junction_id"]
                await configure_junction_for_route(
                    j_id, entry, exit_, "CONFIGURED"
                )
                self._logger.debug(
                    "junction_configured",
                    junction_id=j_id,
                    entry=entry,
                    exit=exit_,
                )