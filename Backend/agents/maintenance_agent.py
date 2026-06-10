"""
RailMind AI - MaintenanceAgent.
Monitors maintenance blocks and generates alerts.
"""

import asyncio
from typing import Any

from backend.agents.base_agent import BaseAgent
from backend.event_bus.events import EventType, BaseEvent
from backend.graph.maintenance_queries import (
    get_active_maintenance_blocks,
    get_upcoming_maintenance,
    get_trains_affected_by_maintenance,
)
from backend.core.logger import get_logger

logger = get_logger("maintenance_agent")


class MaintenanceAgent(BaseAgent):
    """Agent responsible for maintenance monitoring and alert generation."""

    def __init__(self) -> None:
        super().__init__("MaintenanceAgent")
        self._known_blocks: set[str] = set()

    async def _register_handlers(self) -> None:
        pass

    async def _run_loop(self) -> None:
        while self._running:
            try:
                await self._check_active_blocks()
                await self._check_upcoming_blocks()
            except Exception as exc:
                logger.error("maintenance_loop_error", error=str(exc))
            await asyncio.sleep(60.0)

    async def handle_event(self, event: BaseEvent) -> None:
        pass

    async def _check_active_blocks(self) -> None:
        try:
            blocks = await get_active_maintenance_blocks()
        except Exception as exc:
            logger.error("check_active_blocks_failed", error=str(exc))
            return

        current_ids = {b["block_id"] for b in blocks if b and b.get("block_id")}

        new_blocks = current_ids - self._known_blocks
        for block in blocks:
            if not block or not block.get("block_id"):
                continue
            if block["block_id"] in new_blocks:
                try:
                    affected = await get_trains_affected_by_maintenance(
                        block["block_id"]
                    )
                except Exception as exc:
                    logger.error(
                        "get_affected_trains_failed",
                        block_id=block["block_id"],
                        error=str(exc),
                    )
                    affected = []

                # Filter out any None values from the list
                valid_trains = [t for t in affected if t is not None]
                affected_train_numbers = [
                    t["train_number"] for t in valid_trains if t.get("train_number")
                ]

                await self.publish(
                    EventType.MAINTENANCE_REQUIRED,
                    {
                        "block_id": block["block_id"],
                        "track_ids": block.get("affected_tracks", []),
                        "reason": block.get("reason", "unknown"),
                        "urgency": "ACTIVE",
                        "affected_train_count": len(valid_trains),
                        "affected_trains": affected_train_numbers,
                        "start_time": block.get("start_time"),
                        "end_time": block.get("end_time"),
                    },
                )
                self._logger.info(
                    "maintenance_alert_active",
                    block_id=block["block_id"],
                    affected_trains=len(valid_trains),
                )

        self._known_blocks = current_ids

    async def _check_upcoming_blocks(self) -> None:
        try:
            upcoming = await get_upcoming_maintenance(hours_ahead=2.0)
        except Exception as exc:
            logger.error("check_upcoming_blocks_failed", error=str(exc))
            return

        for block in upcoming:
            if not block or not block.get("block_id"):
                continue
            try:
                affected = await get_trains_affected_by_maintenance(
                    block["block_id"]
                )
            except Exception as exc:
                logger.error(
                    "get_affected_trains_failed",
                    block_id=block["block_id"],
                    error=str(exc),
                )
                affected = []

            valid_trains = [t for t in affected if t is not None]
            affected_train_numbers = [
                t["train_number"] for t in valid_trains if t.get("train_number")
            ]

            await self.publish(
                EventType.MAINTENANCE_REQUIRED,
                {
                    "block_id": block["block_id"],
                    "track_ids": block.get("affected_tracks", []),
                    "reason": block.get("reason", "unknown"),
                    "urgency": "UPCOMING",
                    "affected_train_count": len(valid_trains),
                    "affected_trains": affected_train_numbers,
                    "start_time": block.get("start_time"),
                    "end_time": block.get("end_time"),
                },
            )
            self._logger.info(
                "maintenance_alert_upcoming",
                block_id=block["block_id"],
                hours_ahead=2,
            )