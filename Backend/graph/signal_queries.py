"""
RailMind AI - Signal Control Graph Queries.
Cypher queries for signal state management and safety checks.
"""

from typing import Any

from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("signal_queries")


async def get_signal_by_id(signal_id: str) -> dict[str, Any] | None:
    """Retrieve a signal by its unique ID."""
    query = """
    MATCH (sig:Signal {signal_id: $signal_id})
    OPTIONAL MATCH (sig)-[:PROTECTS]->(tr:TrackSegment)
    RETURN sig {
        .*,
        protected_track: tr.track_id
    } AS signal
    """
    result = await neo4j_manager.execute_read(query, {"signal_id": signal_id})
    return result[0]["signal"] if result else None


async def get_signals_for_track(track_id: str) -> list[dict[str, Any]]:
    """Find all signals protecting a specific track segment."""
    query = """
    MATCH (tr:TrackSegment {track_id: $track_id})<-[:PROTECTED_BY]-(sig:Signal)
    RETURN sig {
        .*,
        protected_track: $track_id
    } AS signal
    """
    result = await neo4j_manager.execute_read(query, {"track_id": track_id})
    return [record["signal"] for record in result]


async def update_signal_state(
    signal_id: str,
    state: str,
) -> dict[str, Any] | None:
    """Update the state of a signal (GREEN, RED, YELLOW)."""
    query = """
    MATCH (sig:Signal {signal_id: $signal_id})
    SET sig.state = $state,
        sig.last_changed = datetime()
    RETURN sig {
        .*,
        last_changed: toString(sig.last_changed)
    } AS signal
    """
    result = await neo4j_manager.execute_write(query, {"signal_id": signal_id, "state": state})
    return result[0]["signal"] if result else None


async def check_track_safety_for_signal(
    track_id: str,
    requesting_train_number: str,
) -> dict[str, Any]:
    """
    Comprehensive safety check for a track segment before signal GREEN.
    Checks occupancy, maintenance, downstream conflicts, and junction status.
    """
    query = """
    MATCH (tr:TrackSegment {track_id: $track_id})
    OPTIONAL MATCH (tr)<-[:AFFECTS]-(mb:MaintenanceBlock)
    WHERE mb.status = 'ACTIVE'
    OPTIONAL MATCH (tr)<-[:CURRENTLY_ON|MOVING_TO]-(occupant:Train)
    WHERE occupant.train_number <> $requesting_train_number
    OPTIONAL MATCH (tr)<-[:PROTECTED_BY]-(sig:Signal)
    OPTIONAL MATCH (tr)-[:CONNECTED_TO]->(nextTr:TrackSegment)
    OPTIONAL MATCH (nextTr)<-[:CURRENTLY_ON|MOVING_TO]-(downstream:Train)
    WHERE downstream.train_number <> $requesting_train_number
    OPTIONAL MATCH (j:Junction)-[:CONNECTS]->(tr)
    WHERE j.status IN ['FAULT', 'UNAVAILABLE']
    RETURN {
        track_id: tr.track_id,
        is_clear: occupant IS NULL AND mb IS NULL AND downstream IS NULL AND j IS NULL,
        is_occupied: occupant IS NOT NULL,
        occupant_train: occupant.train_number,
        under_maintenance: mb IS NOT NULL,
        maintenance_block: mb.block_id,
        downstream_blocked: downstream IS NOT NULL,
        downstream_train: downstream.train_number,
        junction_fault: j IS NOT NULL,
        junction_id: j.junction_id,
        current_signal_state: sig.state
    } AS safety_report
    """
    params = {"track_id": track_id, "requesting_train_number": requesting_train_number}
    result = await neo4j_manager.execute_read(query, params)
    return result[0]["safety_report"] if result else {}


async def get_all_signals() -> list[dict[str, Any]]:
    """Retrieve all signals with their protected tracks and current states."""
    query = """
    MATCH (sig:Signal)
    OPTIONAL MATCH (sig)-[:PROTECTED_BY]->(tr:TrackSegment)
    OPTIONAL MATCH (tr)<-[:CURRENTLY_ON]-(t:Train)
    RETURN sig {
        .*,
        protected_track: tr.track_id,
        occupied_by: t.train_number,
        last_changed: toString(sig.last_changed)
    } AS signal
    """
    result = await neo4j_manager.execute_read(query)
    return [record["signal"] for record in result]


async def cascade_signal_red(
    track_id: str,
    source_event: str,
) -> list[dict[str, Any]]:
    """
    Set upstream signals to RED when a track becomes unsafe.
    Returns affected signals.
    """
    query = """
    MATCH (tr:TrackSegment {track_id: $track_id})
    MATCH (tr)<-[:PROTECTED_BY]-(sig:Signal)
    WHERE sig.state <> 'RED'
    SET sig.state = 'RED',
        sig.last_changed = datetime(),
        sig.red_reason = $source_event
    RETURN sig {
        .*,
        last_changed: toString(sig.last_changed)
    } AS signal
    """
    result = await neo4j_manager.execute_write(query, {"track_id": track_id, "source_event": source_event})
    return [record["signal"] for record in result]


async def get_signal_dependencies(signal_id: str) -> list[dict[str, Any]]:
    """Find downstream signals that depend on this signal's state."""
    query = """
    MATCH (sig:Signal {signal_id: $signal_id})-[:PROTECTED_BY]->(tr:TrackSegment)
    MATCH (tr)-[:CONNECTED_TO*1..5]->(downstreamTr:TrackSegment)
    MATCH (downstreamTr)<-[:PROTECTED_BY]-(downSig:Signal)
    RETURN DISTINCT downSig {
        .*,
        dependent_track: downstreamTr.track_id
    } AS dependent_signal
    """
    result = await neo4j_manager.execute_read(query, {"signal_id": signal_id})
    return [record["dependent_signal"] for record in result]