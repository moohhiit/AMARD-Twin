"""
RailMind AI - NetworkMonitoringAgent.
Maintains digital twin state, aggregates system metrics, and feeds the dashboard.
"""

import asyncio
from typing import Any

from backend.agents.base_agent import BaseAgent
from backend.event_bus.events import EventType, BaseEvent
from backend.graph.neo4j_client import neo4j_manager
from backend.core.config import settings
from backend.core.logger import get_logger

logger = get_logger("monitoring_agent")


class NetworkMonitoringAgent(BaseAgent):
    """Agent acting as Digital Twin Coordinator for system-wide monitoring."""

    def __init__(self) -> None:
        super().__init__("NetworkMonitoringAgent")
        self._digital_twin: dict[str, Any] = {
            "trains": {},
            "tracks": {},
            "signals": {},
            "platforms": {},
            "zones": {},
            "events": [],
            "metrics": {},
        }
        self._metrics_lock = asyncio.Lock()

    async def _register_handlers(self) -> None:
        for event_type in EventType:
            self.subscribe(event_type, self._on_any_event)

    async def _run_loop(self) -> None:
        while self._running:
            await self._aggregate_metrics()
            await asyncio.sleep(settings.DIGITAL_TWIN_UPDATE_INTERVAL)

    async def handle_event(self, event: BaseEvent) -> None:
        pass

    async def _on_any_event(self, event: BaseEvent) -> None:
        async with self._metrics_lock:
            self._digital_twin["events"].append(
                {
                    "event_id": event.event_id,
                    "type": event.event_type.value,
                    "source": event.source_agent,
                    "timestamp": event.timestamp.isoformat(),
                    "payload_keys": list(event.payload.keys()),
                }
            )
            if len(self._digital_twin["events"]) > 1000:
                self._digital_twin["events"] = self._digital_twin["events"][-500:]

        if event.event_type in (
            EventType.TRAIN_APPROACHING,
            EventType.TRAIN_DELAYED,
            EventType.MOVEMENT_AUTHORITY_GRANTED,
        ):
            train_number = event.payload.get("train_number")
            if train_number:
                async with self._metrics_lock:
                    self._digital_twin["trains"][train_number] = {
                        "last_event": event.event_type.value,
                        "last_update": event.timestamp.isoformat(),
                        "location": event.payload.get("location"),
                        "status": event.payload.get("status"),
                        "delay_minutes": event.payload.get("delay_minutes", 0),
                    }

    async def _aggregate_metrics(self) -> None:
        metrics = await self._query_network_state()
        async with self._metrics_lock:
            self._digital_twin["metrics"] = metrics

    async def _query_network_state(self) -> dict[str, Any]:
        query = """
        CALL {
            MATCH (t:Train)
            RETURN count(t) AS train_count,
                   avg(toFloat(t.speed)) AS avg_speed,
                   count(CASE WHEN t.status = 'STOPPED' THEN 1 END) AS stopped_count,
                   count(CASE WHEN t.status = 'DELAYED' THEN 1 END) AS delayed_count
        }
        CALL {
            MATCH (tr:TrackSegment)
            RETURN count(tr) AS track_count,
                   count(CASE WHEN tr.status = 'ACTIVE' THEN 1 END) AS active_tracks,
                   count(CASE WHEN tr.status = 'MAINTENANCE' THEN 1 END) AS maintenance_tracks
        }
        CALL {
            MATCH (sig:Signal)
            RETURN count(sig) AS signal_count,
                   count(CASE WHEN sig.state = 'GREEN' THEN 1 END) AS green_signals,
                   count(CASE WHEN sig.state = 'RED' THEN 1 END) AS red_signals
        }
        CALL {
            MATCH (p:Platform)
            RETURN count(p) AS platform_count,
                   count(CASE WHEN p.status = 'FREE' THEN 1 END) AS free_platforms,
                   count(CASE WHEN p.status = 'OCCUPIED' THEN 1 END) AS occupied_platforms
        }
        CALL {
            MATCH (z:Zone)
            RETURN count(z) AS zone_count,
                   avg(toFloat(z.occupancy_level)) AS avg_occupancy,
                   avg(toFloat(z.congestion_level)) AS avg_congestion,
                   avg(toFloat(z.risk_score)) AS avg_risk
        }
        RETURN {
            train_count: train_count,
            avg_speed: avg_speed,
            stopped_count: stopped_count,
            delayed_count: delayed_count,
            track_count: track_count,
            active_tracks: active_tracks,
            maintenance_tracks: maintenance_tracks,
            signal_count: signal_count,
            green_signals: green_signals,
            red_signals: red_signals,
            platform_count: platform_count,
            free_platforms: free_platforms,
            occupied_platforms: occupied_platforms,
            zone_count: zone_count,
            avg_occupancy: avg_occupancy,
            avg_congestion: avg_congestion,
            avg_risk: avg_risk
        } AS metrics
        """
        result = await neo4j_manager.execute_read(query)
        return result[0]["metrics"] if result else {}

    def get_digital_twin_state(self) -> dict[str, Any]:
        """Return a snapshot of the current digital twin state."""
        return self._digital_twin.copy()

    async def get_live_metrics(self) -> dict[str, Any]:
        """Return current aggregated metrics."""
        async with self._metrics_lock:
            return self._digital_twin["metrics"].copy()