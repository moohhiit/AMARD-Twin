"""
RailMind AI - Monitoring Service.
Digital twin access, network state retrieval, and dashboard data aggregation.
"""

from typing import Any

from backend.agents.monitoring_agent import NetworkMonitoringAgent
from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("monitoring_service")


def _convert_neo4j_datetimes(obj: Any) -> Any:
    """Recursively convert neo4j.time.* objects to ISO strings."""
    if isinstance(obj, dict):
        return {k: _convert_neo4j_datetimes(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_neo4j_datetimes(item) for item in obj]
    elif hasattr(obj, "__class__") and obj.__class__.__module__ == "neo4j.time":
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        return str(obj)
    return obj


class MonitoringService:
    """Service for digital twin state and network monitoring."""

    def __init__(self, monitoring_agent: NetworkMonitoringAgent) -> None:
        self._monitoring_agent = monitoring_agent

    async def get_network_state(self) -> dict[str, Any]:
        """Retrieve the complete current network state."""
        query = """
        CALL {
            MATCH (t:Train)
            RETURN collect(t {
                train_number: t.train_number,
                name: t.name,
                status: t.status,
                speed: t.speed,
                direction: t.direction,
                current_track: t.current_track,
                next_track: t.next_track,
                route_id: t.route_id,
                progress_on_track: t.progress_on_track,
                train_length_m: t.train_length_m,
                current_platform: t.current_platform,
                last_updated: toString(t.last_updated)
            }) AS trains
        }
        CALL {
            MATCH (tr:TrackSegment)
            OPTIONAL MATCH (tr)-[:PART_OF]->(z:Zone)
            OPTIONAL MATCH (tr)<-[:CURRENTLY_ON]-(t:Train)
            RETURN collect(tr {
                track_id: tr.track_id,
                length_km: tr.length_km,
                speed_limit: tr.speed_limit,
                status: tr.status,
                risk_level: tr.risk_level,
                zone_id: z.zone_id,
                occupied_by: t.train_number
            }) AS tracks
        }
        CALL {
            MATCH (sig:Signal)
            OPTIONAL MATCH (sig)-[:PROTECTED_BY]->(tr:TrackSegment)
            RETURN collect(sig {
                signal_id: sig.signal_id,
                state: sig.state,
                controlled_track: sig.controlled_track,
                protected_track: tr.track_id,
                last_changed: toString(sig.last_changed)
            }) AS signals
        }
        CALL {
            MATCH (p:Platform)
            OPTIONAL MATCH (p)<-[:HAS_PLATFORM]-(s:Station)
            OPTIONAL MATCH (p)<-[:AT_PLATFORM]-(t:Train)
            RETURN collect(p {
                platform_id: p.platform_id,
                platform_number: p.platform_number,
                name: p.name,
                status: p.status,
                length_m: p.length_m,
                station_id: s.station_id,
                station_name: s.name,
                occupied_by: t.train_number
            }) AS platforms
        }
        CALL {
            MATCH (z:Zone)
            RETURN collect(z {
                zone_id: z.zone_id,
                name: z.name,
                occupancy_level: z.occupancy_level,
                congestion_level: z.congestion_level,
                risk_score: z.risk_score
            }) AS zones
        }
        CALL {
            MATCH (e:Event)
            RETURN collect(e {
                event_id: e.event_id,
                event_type: e.event_type,
                severity: e.severity,
                timestamp: toString(e.timestamp),
                resolved: e.resolved,
                source_train: e.source_train,
                delay_minutes: e.delay_minutes,
                location: e.location
            }) AS events
        }
        RETURN {
            trains: trains,
            tracks: tracks,
            signals: signals,
            platforms: platforms,
            zones: zones,
            events: events
        } AS network_state
        """
        result = await neo4j_manager.execute_read(query)
        raw = result[0]["network_state"] if result else {}
        return _convert_neo4j_datetimes(raw)

    async def get_train_positions(self) -> list[dict[str, Any]]:
        """Get current positions of all trains."""
        query = """
        MATCH (t:Train)
        OPTIONAL MATCH (t)-[:CURRENTLY_ON]->(tr:TrackSegment)
        OPTIONAL MATCH (t)-[:IN_ZONE]->(z:Zone)
        RETURN t {
            train_number: t.train_number,
            name: t.name,
            status: t.status,
            speed: t.speed,
            direction: t.direction,
            current_track: t.current_track,
            next_track: t.next_track,
            route_id: t.route_id,
            progress_on_track: t.progress_on_track,
            train_length_m: t.train_length_m,
            current_platform: t.current_platform,
            last_updated: toString(t.last_updated)
        } AS train,
        tr.track_id AS track_id,
        z.zone_id AS zone_id,
        t.progress_on_track AS progress
        """
        result = await neo4j_manager.execute_read(query)
        return _convert_neo4j_datetimes([
            {
                "train_number": r["train"]["train_number"],
                "name": r["train"]["name"],
                "status": r["train"]["status"],
                "speed": r["train"]["speed"],
                "direction": r["train"]["direction"],
                "current_track": r["track_id"],
                "zone": r["zone_id"],
                "progress_on_track": r["progress"],
                "last_updated": r["train"]["last_updated"],
            }
            for r in result
        ])

    async def get_system_metrics(self) -> dict[str, Any]:
        """Get aggregated system metrics from the digital twin."""
        metrics = await self._monitoring_agent.get_live_metrics()
        return _convert_neo4j_datetimes({
            "digital_twin_metrics": metrics,
            "event_bus_metrics": self._monitoring_agent.event_manager.get_metrics(),
        })

    async def get_recent_events(
        self,
        limit: int = 50,
        event_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get recent system events."""
        if event_type:
            query = """
            MATCH (e:Event {event_type: $event_type})
            RETURN e {
                event_id: e.event_id,
                event_type: e.event_type,
                severity: e.severity,
                timestamp: toString(e.timestamp),
                resolved: e.resolved,
                source_train: e.source_train,
                delay_minutes: e.delay_minutes,
                location: e.location
            } AS event
            ORDER BY e.timestamp DESC
            LIMIT $limit
            """
            params = {"event_type": event_type, "limit": limit}
        else:
            query = """
            MATCH (e:Event)
            RETURN e {
                event_id: e.event_id,
                event_type: e.event_type,
                severity: e.severity,
                timestamp: toString(e.timestamp),
                resolved: e.resolved,
                source_train: e.source_train,
                delay_minutes: e.delay_minutes,
                location: e.location
            } AS event
            ORDER BY e.timestamp DESC
            LIMIT $limit
            """
            params = {"limit": limit}

        result = await neo4j_manager.execute_read(query, params)
        return _convert_neo4j_datetimes([r["event"] for r in result])

    def get_digital_twin_snapshot(self) -> dict[str, Any]:
        """Get a snapshot of the monitoring agent's digital twin state."""
        return _convert_neo4j_datetimes(self._monitoring_agent.get_digital_twin_state())