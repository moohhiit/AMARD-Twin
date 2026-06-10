"""
RailMind AI - DelayPropagationAgent.
Predicts downstream delays and estimates congestion impact.
"""

import asyncio
from typing import Any

from backend.agents.base_agent import BaseAgent
from backend.event_bus.events import EventType, BaseEvent
from backend.graph.train_queries import get_train_by_number
from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("delay_agent")


class DelayPropagationAgent(BaseAgent):
    """Agent responsible for delay prediction and cascade estimation."""

    def __init__(self) -> None:
        super().__init__("DelayPropagationAgent")

    async def _register_handlers(self) -> None:
        self.subscribe(EventType.TRAIN_DELAYED, self._on_train_delayed)

    async def _run_loop(self) -> None:
        while self._running:
            await asyncio.sleep(30.0)

    async def handle_event(self, event: BaseEvent) -> None:
        pass

    async def _on_train_delayed(self, event: BaseEvent) -> None:
        payload = event.payload
        train_number = payload.get("train_number")
        delay_minutes = payload.get("delay_minutes", 0)
        location = payload.get("location")

        if not train_number or delay_minutes <= 0:
            return

        self._logger.info(
            "analyzing_delay_propagation",
            train=train_number,
            delay=delay_minutes,
            location=location,
        )

        downstream_trains = await self._get_downstream_trains(location)
        cascade_count = 0

        for downstream in downstream_trains:
            estimated_delay = self._estimate_cascade_delay(
                original_delay=delay_minutes,
                distance=downstream.get("distance", 0),
                train_speed=downstream.get("speed", 50),
            )
            if estimated_delay > 2:
                cascade_count += 1
                await self.publish(
                    EventType.TRAIN_DELAYED,
                    {
                        "train_number": downstream["train_number"],
                        "delay_minutes": round(estimated_delay, 1),
                        "reason": f"cascade_from_{train_number}",
                        "location": downstream.get("current_track"),
                        "estimated_cascade_impact": max(0, int(estimated_delay / 5)),
                    },
                    correlation_id=event.correlation_id or event.event_id,
                )

        await self.publish(
            EventType.TRAIN_DELAYED,
            {
                "train_number": train_number,
                "delay_minutes": delay_minutes,
                "reason": payload.get("reason", "unknown"),
                "location": location,
                "estimated_cascade_impact": cascade_count,
                "analysis_complete": True,
            },
            correlation_id=event.correlation_id or event.event_id,
        )

    async def _get_downstream_trains(
        self, track_id: str | None
    ) -> list[dict[str, Any]]:
        if not track_id:
            return []
        query = """
        MATCH path = (start:TrackSegment {track_id: $track_id})-[:CONNECTED_TO*1..10]->(downstream:TrackSegment)
        MATCH (downstream)<-[:CURRENTLY_ON|MOVING_TO]-(t:Train)
        RETURN DISTINCT t.train_number AS train_number,
               t.speed AS speed,
               downstream.track_id AS current_track,
               reduce(d = 0.0, tr IN relationships(path) | d + tr.length_km) AS distance
        """
        result = await neo4j_manager.execute_read(query, {"track_id": track_id})
        return [
            {
                "train_number": r["train_number"],
                "speed": r["speed"],
                "current_track": r["current_track"],
                "distance": r["distance"],
            }
            for r in result
        ]

    def _estimate_cascade_delay(
        self,
        original_delay: float,
        distance: float,
        train_speed: float,
    ) -> float:
        if train_speed <= 0:
            return original_delay
        time_to_impact = (distance / train_speed) * 60.0
        decay_factor = max(0.3, 1.0 - (time_to_impact / 120.0))
        return original_delay * decay_factor