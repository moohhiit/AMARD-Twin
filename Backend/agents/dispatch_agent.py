"""
RailMind AI - TrainDispatchAgent.
Prioritizes train movement and issues movement authority.
"""

import asyncio
from typing import Any

from backend.agents.base_agent import BaseAgent
from backend.event_bus.events import EventType, BaseEvent
from backend.graph.train_queries import get_train_by_number
from backend.core.logger import get_logger

logger = get_logger("dispatch_agent")


class TrainDispatchAgent(BaseAgent):
    """Agent responsible for dispatch prioritization and movement authority."""

    def __init__(self) -> None:
        super().__init__("TrainDispatchAgent")
        self._authority_queue: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()

    async def _register_handlers(self) -> None:
        self.subscribe(EventType.SIGNAL_GREEN, self._on_signal_green)
        self.subscribe(EventType.ROUTE_CLEAR, self._on_route_clear)

    async def _run_loop(self) -> None:
        while self._running:
            async with self._lock:
                if self._authority_queue:
                    self._authority_queue.sort(
                        key=lambda x: (
                            -x.get("priority", 0),
                            x.get("timestamp", 0),
                        )
                    )
            await asyncio.sleep(1.0)

    async def handle_event(self, event: BaseEvent) -> None:
        pass

    async def _on_signal_green(self, event: BaseEvent) -> None:
        payload = event.payload
        train_number = payload.get("train_number")
        track_id = payload.get("track_id")

        if not train_number:
            return

        train = await get_train_by_number(train_number)
        if not train:
            return

        priority = self._calculate_priority(train)
        authority = {
            "train_number": train_number,
            "track_id": track_id,
            "priority": priority,
            "timestamp": asyncio.get_event_loop().time(),
            "max_speed": self._calculate_max_speed(train, track_id),
            "distance_km": payload.get("distance_km", 1.0),
        }

        async with self._lock:
            self._authority_queue.append(authority)

        await self._process_authority_queue()

    async def _on_route_clear(self, event: BaseEvent) -> None:
        train_number = event.payload.get("train_number")
        if train_number:
            async with self._lock:
                self._authority_queue = [
                    a
                    for a in self._authority_queue
                    if a["train_number"] != train_number
                ]
            await self._process_authority_queue()

    async def _process_authority_queue(self) -> None:
        async with self._lock:
            if not self._authority_queue:
                return
            self._authority_queue.sort(
                key=lambda x: (
                    -x.get("priority", 0),
                    x.get("timestamp", 0),
                )
            )
            top = self._authority_queue.pop(0)

        await self.publish(
            EventType.MOVEMENT_AUTHORITY_GRANTED,
            {
                "train_number": top["train_number"],
                "authority_type": "PROCEED",
                "max_speed": top["max_speed"],
                "distance_km": top["distance_km"],
                "until_track": top["track_id"],
                "priority": top["priority"],
            },
        )
        self._logger.info(
            "movement_authority_granted",
            train=top["train_number"],
            track=top["track_id"],
            priority=top["priority"],
        )

    def _calculate_priority(self, train: dict[str, Any]) -> int:
        base = train.get("speed", 0)
        if train.get("route_id"):
            base += 50
        if train.get("status") == "DELAYED":
            base += 20
        return int(base)

    def _calculate_max_speed(
        self, train: dict[str, Any], track_id: str
    ) -> float:
        train_speed = train.get("speed", 0)
        return min(train_speed * 1.2, 120.0)