"""
RailMind AI - EmergencyResponseAgent.
Handles failures, stops affected trains, and blocks routes.
"""

import asyncio
from typing import Any

from backend.agents.base_agent import BaseAgent
from backend.event_bus.events import EventType, BaseEvent
from backend.graph.signal_queries import cascade_signal_red
from backend.graph.route_queries import clear_route_reservation
from backend.graph.train_queries import get_train_by_number, update_train_position
from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("emergency_agent")


class EmergencyResponseAgent(BaseAgent):
    """Agent responsible for emergency response and safety intervention."""

    def __init__(self) -> None:
        super().__init__("EmergencyResponseAgent")

    async def _register_handlers(self) -> None:
        self.subscribe(EventType.EMERGENCY_TRIGGERED, self._on_emergency)
        self.subscribe(EventType.ROUTE_CONFLICT, self._on_critical_conflict)

    async def _run_loop(self) -> None:
        while self._running:
            await asyncio.sleep(5.0)

    async def handle_event(self, event: BaseEvent) -> None:
        pass

    async def _on_emergency(self, event: BaseEvent) -> None:
        payload = event.payload
        emergency_type = payload.get("emergency_type", "UNKNOWN")
        location = payload.get("location")
        affected_trains = payload.get("affected_trains", [])
        action = payload.get("immediate_action", "STOP_ALL")

        self._logger.critical(
            "emergency_response_initiated",
            type=emergency_type,
            location=location,
            affected=len(affected_trains),
            action=action,
        )

        if location:
            signals = await cascade_signal_red(
                location, f"emergency:{emergency_type}"
            )
            await self.publish(
                EventType.SIGNAL_RED,
                {
                    "signal_id": "EMERGENCY_CASCADE",
                    "track_id": location,
                    "reason": emergency_type,
                    "cascade": True,
                    "emergency_event_id": event.event_id,
                },
                correlation_id=event.correlation_id or event.event_id,
            )
            self._logger.info(
                "emergency_signals_red",
                location=location,
                signals_affected=len(signals),
            )

        for train_number in affected_trains:
            await self._stop_train(train_number)
            await clear_route_reservation(train_number)
            await self.publish(
                EventType.TRAIN_DELAYED,
                {
                    "train_number": train_number,
                    "delay_minutes": 999,
                    "reason": f"emergency_stop:{emergency_type}",
                    "location": location,
                },
                correlation_id=event.correlation_id or event.event_id,
            )

        if action == "STOP_ALL" and location:
            query = """
            MATCH (tr:TrackSegment {track_id: $track_id})<-[:CURRENTLY_ON|MOVING_TO]-(t:Train)
            WHERE NOT t.train_number IN $affected_trains
            RETURN t.train_number AS train_number
            """
            result = await neo4j_manager.execute_read(
                query,
                {
                    "track_id": location,
                    "affected_trains": affected_trains,
                },
            )
            for record in result:
                tn = record["train_number"]
                await self._stop_train(tn)
                await clear_route_reservation(tn)

    async def _on_critical_conflict(self, event: BaseEvent) -> None:
        if event.payload.get("severity") == "CRITICAL":
            location = (
                event.payload.get("track_id")
                or event.payload.get("junction_id")
            )
            affected = [
                event.payload.get("train_a"),
                event.payload.get("train_b"),
            ]
            await self._on_emergency(
                BaseEvent(
                    event_type=EventType.EMERGENCY_TRIGGERED,
                    event_id=event.event_id,
                    source_agent="EmergencyResponseAgent",
                    correlation_id=event.correlation_id,
                    payload={
                        "emergency_type": f"CONFLICT:{event.payload.get('conflict_type', 'UNKNOWN')}",
                        "location": location,
                        "affected_trains": [
                            a for a in affected if a is not None
                        ],
                        "immediate_action": "STOP_ALL",
                        "triggered_by": "ConflictDetectionAgent",
                    },
                )
            )

    async def _stop_train(self, train_number: str) -> None:
        train = await get_train_by_number(train_number)
        if not train:
            return
        await update_train_position(
            train_number=train_number,
            current_track=train.get("current_track", "UNKNOWN"),
            next_track=None,
            progress_on_track=train.get("progress_on_track", 0.0),
            speed=0.0,
            status="STOPPED",
        )
        self._logger.info("train_stopped", train_number=train_number)