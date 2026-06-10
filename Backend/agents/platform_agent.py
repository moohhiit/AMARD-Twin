"""
RailMind AI - PlatformAllocationAgent.
Finds free platforms, matches train length, checks maintenance restrictions, assigns platform.
"""

import asyncio
from typing import Any

from backend.agents.base_agent import BaseAgent
from backend.event_bus.events import EventType, BaseEvent
from backend.graph.platform_queries import (
    find_best_platform_for_train,
    assign_platform_to_train,
)
from backend.graph.train_queries import get_train_by_number
from backend.core.logger import get_logger

logger = get_logger("platform_agent")


class PlatformAllocationAgent(BaseAgent):
    """Agent responsible for platform discovery, matching, and assignment."""

    def __init__(self) -> None:
        super().__init__("PlatformAllocationAgent")

    async def _register_handlers(self) -> None:
        self.subscribe(EventType.TRAIN_APPROACHING, self._on_train_approaching)

    async def _run_loop(self) -> None:
        while self._running:
            await asyncio.sleep(5.0)

    async def handle_event(self, event: BaseEvent) -> None:
        pass

    async def _on_train_approaching(self, event: BaseEvent) -> None:
        payload = event.payload
        train_number = payload.get("train_number")
        station_id = payload.get("station_id")

        if not train_number or not station_id:
            self._logger.warning(
                "approaching_event_missing_data",
                payload=payload,
            )
            return

        train = await get_train_by_number(train_number)
        if not train:
            self._logger.warning("train_not_found", train_number=train_number)
            return

        platform = await find_best_platform_for_train(train_number, station_id)
        if not platform:
            self._logger.warning(
                "no_suitable_platform",
                train_number=train_number,
                station_id=station_id,
                train_length_m=train.get("train_length_m"),
            )
            return

        assigned = await assign_platform_to_train(
            train_number, platform["platform_id"]
        )
        if not assigned:
            self._logger.error(
                "platform_assignment_failed",
                train_number=train_number,
                platform_id=platform["platform_id"],
            )
            return

        await self.publish(
            EventType.PLATFORM_ASSIGNED,
            {
                "train_number": train_number,
                "platform_id": platform["platform_id"],
                "station_id": station_id,
                "assignment_reason": "length_match_maintenance_clear",
                "platform_length_m": platform.get("length_m"),
                "train_length_m": train.get("train_length_m"),
            },
            correlation_id=event.correlation_id or event.event_id,
        )
        self._logger.info(
            "platform_assigned",
            train_number=train_number,
            platform_id=platform["platform_id"],
            station_id=station_id,
        )