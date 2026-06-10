"""
RailMind AI - LoopLineAgent.
Diverts slower trains and prioritizes faster trains on shared segments.
"""

import asyncio
from typing import Any

from backend.agents.base_agent import BaseAgent
from backend.event_bus.events import EventType, BaseEvent
from backend.graph.conflict_queries import detect_loop_line_conflicts
from backend.graph.route_queries import reserve_route, clear_route_reservation
from backend.graph.train_queries import get_train_by_number
from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("loopline_agent")


class LoopLineAgent(BaseAgent):
    """Agent responsible for loop line diversion and train prioritization."""

    def __init__(self) -> None:
        super().__init__("LoopLineAgent")

    async def _register_handlers(self) -> None:
        self.subscribe(EventType.ROUTE_CONFLICT, self._on_route_conflict)
        self.subscribe(EventType.TRAIN_DELAYED, self._on_train_delayed)

    async def _run_loop(self) -> None:
        while self._running:
            conflicts = await detect_loop_line_conflicts()
            for conflict in conflicts:
                await self._handle_loop_conflict(conflict)
            await asyncio.sleep(10.0)

    async def handle_event(self, event: BaseEvent) -> None:
        pass

    async def _on_route_conflict(self, event: BaseEvent) -> None:
        if event.payload.get("conflict_type") == "LOOP_LINE_PRIORITY":
            await self._handle_loop_conflict(event.payload)

    async def _on_train_delayed(self, event: BaseEvent) -> None:
        train_number = event.payload.get("train_number")
        if not train_number:
            return
        train = await get_train_by_number(train_number)
        if train and train.get("speed", 0) < 30:
            await self._attempt_diversion(train_number)

    async def _handle_loop_conflict(self, conflict: dict[str, Any]) -> None:
        slower_train = conflict.get("slower_train")
        if not slower_train:
            return
        self._logger.info(
            "handling_loop_conflict",
            slower=slower_train,
            faster=conflict.get("faster_train"),
            track=conflict.get("track_id"),
        )
        await self._attempt_diversion(slower_train, conflict.get("track_id"))

    async def _attempt_diversion(
        self, train_number: str, blocked_track: str | None = None
    ) -> None:
        train = await get_train_by_number(train_number)
        if not train:
            return
        current = train.get("current_track")
        if not current:
            return

        blocked = blocked_track or current
        query = """
        MATCH (current:TrackSegment {track_id: $current_track})
        MATCH (current)-[:CONNECTED_TO]-(alt:TrackSegment)
        WHERE alt.track_id <> $blocked_track
          AND alt.status IN ['ACTIVE', 'OPERATIONAL']
          AND NOT EXISTS {
              MATCH (alt)<-[:AFFECTS]-(mb:MaintenanceBlock)
              WHERE mb.status = 'ACTIVE'
          }
        RETURN alt.track_id AS alt_track
        LIMIT 1
        """
        result = await neo4j_manager.execute_read(
            query, {"current_track": current, "blocked_track": blocked}
        )
        if not result:
            self._logger.info(
                "no_alternative_track",
                train_number=train_number,
                current=current,
            )
            return

        alt_track = result[0]["alt_track"]
        route_id = f"RTE_LL_{train_number}_{asyncio.get_event_loop().time():.0f}"
        reserved = await reserve_route(
            route_id, train_number, [current, alt_track]
        )
        if reserved:
            await clear_route_reservation(train_number)
            await self.publish(
                EventType.ROUTE_ASSIGNED,
                {
                    "train_number": train_number,
                    "route_id": route_id,
                    "track_sequence": [current, alt_track],
                    "reason": "loop_line_diversion",
                    "previous_track": blocked,
                },
            )
            self._logger.info(
                "train_diverted",
                train_number=train_number,
                route_id=route_id,
                new_track=alt_track,
            )