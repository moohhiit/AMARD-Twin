"""
RailMind AI - SignalControlAgent.
Manages signal states based on track safety, occupancy, and conflict status.
"""

import asyncio
from typing import Any

from backend.agents.base_agent import BaseAgent
from backend.event_bus.events import EventType, BaseEvent
from backend.graph.signal_queries import (
    get_signals_for_track,
    update_signal_state,
    check_track_safety_for_signal,
    cascade_signal_red,
)
from backend.graph.train_queries import get_train_by_number
from backend.core.logger import get_logger

logger = get_logger("signal_agent")


class SignalControlAgent(BaseAgent):
    """Agent responsible for signal state management and safety checks."""

    def __init__(self) -> None:
        super().__init__("SignalControlAgent")

    async def _register_handlers(self) -> None:
        self.subscribe(EventType.ROUTE_ASSIGNED, self._on_route_assigned)
        self.subscribe(EventType.ROUTE_CONFLICT, self._on_route_conflict)
        self.subscribe(EventType.EMERGENCY_TRIGGERED, self._on_emergency)

    async def _run_loop(self) -> None:
        while self._running:
            await asyncio.sleep(2.0)

    async def handle_event(self, event: BaseEvent) -> None:
        pass

    async def _on_route_assigned(self, event: BaseEvent) -> None:
        payload = event.payload
        train_number = payload.get("train_number")
        track_sequence = payload.get("track_sequence", [])

        if not train_number or not track_sequence:
            return

        train = await get_train_by_number(train_number)
        if not train:
            return

        for track_id in track_sequence:
            safety = await check_track_safety_for_signal(track_id, train_number)
            if not safety:
                continue

            signals = await get_signals_for_track(track_id)
            if safety.get("is_clear"):
                for sig in signals:
                    if sig.get("state") != "GREEN":
                        await update_signal_state(sig["signal_id"], "GREEN")
                        await self.publish(
                            EventType.SIGNAL_GREEN,
                            {
                                "signal_id": sig["signal_id"],
                                "track_id": track_id,
                                "train_number": train_number,
                                "safety_check_passed": True,
                            },
                            correlation_id=event.correlation_id or event.event_id,
                        )
                        self._logger.info(
                            "signal_set_green",
                            signal_id=sig["signal_id"],
                            track_id=track_id,
                            train=train_number,
                        )
            else:
                for sig in signals:
                    if sig.get("state") != "RED":
                        reason = self._derive_reason(safety)
                        await update_signal_state(sig["signal_id"], "RED")
                        await self.publish(
                            EventType.SIGNAL_RED,
                            {
                                "signal_id": sig["signal_id"],
                                "track_id": track_id,
                                "reason": reason,
                                "cascade": False,
                            },
                            correlation_id=event.correlation_id or event.event_id,
                        )
                        self._logger.info(
                            "signal_set_red",
                            signal_id=sig["signal_id"],
                            track_id=track_id,
                            reason=reason,
                        )

    async def _on_route_conflict(self, event: BaseEvent) -> None:
        track_id = event.payload.get("track_id")
        if track_id:
            await cascade_signal_red(track_id, "route_conflict")
            await self.publish(
                EventType.SIGNAL_RED,
                {
                    "signal_id": "CASCADE",
                    "track_id": track_id,
                    "reason": "route_conflict",
                    "cascade": True,
                },
                correlation_id=event.correlation_id or event.event_id,
            )

    async def _on_emergency(self, event: BaseEvent) -> None:
        location = event.payload.get("location")
        if location:
            await cascade_signal_red(location, "emergency")
            await self.publish(
                EventType.SIGNAL_RED,
                {
                    "signal_id": "CASCADE",
                    "track_id": location,
                    "reason": "emergency",
                    "cascade": True,
                },
                correlation_id=event.correlation_id or event.event_id,
            )

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