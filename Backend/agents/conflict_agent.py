"""
RailMind AI - ConflictDetectionAgent.
Detects route conflicts, junction conflicts, and track occupancy conflicts.
"""

import asyncio
from typing import Any

from backend.agents.base_agent import BaseAgent
from backend.event_bus.events import EventType, BaseEvent
from backend.graph.conflict_queries import (
    detect_track_occupancy_conflicts,
    detect_route_conflicts,
    detect_junction_conflicts,
    detect_headway_conflicts,
)
from backend.core.logger import get_logger

logger = get_logger("conflict_agent")


class ConflictDetectionAgent(BaseAgent):
    """Agent responsible for continuous conflict detection and alerting."""

    def __init__(self) -> None:
        super().__init__("ConflictDetectionAgent")

    async def _register_handlers(self) -> None:
        self.subscribe(EventType.TRAIN_APPROACHING, self._on_train_approaching)

    async def _run_loop(self) -> None:
        while self._running:
            await self._scan_all_conflicts()
            await asyncio.sleep(3.0)

    async def handle_event(self, event: BaseEvent) -> None:
        pass

    async def _on_train_approaching(self, event: BaseEvent) -> None:
        await self._scan_all_conflicts()

    async def _scan_all_conflicts(self) -> None:
        scans = [
            ("track_occupancy", detect_track_occupancy_conflicts()),
            ("route_overlap", detect_route_conflicts()),
            ("junction", detect_junction_conflicts()),
            ("headway", detect_headway_conflicts()),
        ]

        for scan_name, coro in scans:
            try:
                conflicts = await coro
                for conflict in conflicts:
                    await self._emit_conflict(conflict)
            except Exception as exc:
                self._logger.error(
                    "conflict_scan_failed",
                    scan=scan_name,
                    error=str(exc),
                )

    async def _emit_conflict(self, conflict: dict[str, Any]) -> None:
        severity = conflict.get("severity", "MEDIUM")
        payload: dict[str, Any] = {
            "conflict_type": conflict.get("conflict_type"),
            "severity": severity,
            "details": conflict,
        }

        if conflict.get("track_id"):
            payload["track_id"] = conflict["track_id"]
        if conflict.get("junction_id"):
            payload["junction_id"] = conflict["junction_id"]
        if conflict.get("train_a"):
            payload["train_a"] = conflict["train_a"]
        if conflict.get("train_b"):
            payload["train_b"] = conflict["train_b"]

        await self.publish(EventType.ROUTE_CONFLICT, payload)

        if severity == "CRITICAL":
            location = (
                conflict.get("track_id")
                or conflict.get("junction_id")
                or "UNKNOWN"
            )
            affected: list[str] = []
            if conflict.get("train_a"):
                affected.append(conflict["train_a"])
            if conflict.get("train_b"):
                affected.append(conflict["train_b"])
            if conflict.get("trains"):
                for t in conflict["trains"]:
                    if isinstance(t, dict):
                        affected.append(str(t.get("train_number", "")))
                    elif isinstance(t, str):
                        affected.append(t)

            await self.publish(
                EventType.EMERGENCY_TRIGGERED,
                {
                    "emergency_type": f"CONFLICT:{conflict.get('conflict_type', 'UNKNOWN')}",
                    "location": location,
                    "affected_trains": list({a for a in affected if a}),
                    "immediate_action": "STOP_ALL",
                    "triggered_by": "ConflictDetectionAgent",
                },
            )
            self._logger.critical(
                "critical_conflict_emergency",
                conflict=conflict,
            )