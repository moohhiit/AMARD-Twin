"""
RailMind AI - Maintenance Detection Graph Queries.
Cypher queries for maintenance block monitoring and alert generation.
"""

from datetime import datetime
from typing import Any

from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("maintenance_queries")


async def create_maintenance_block(
    block_id: str,
    reason: str,
    start_time: datetime,
    end_time: datetime,
    status: str,
    affected_track_ids: list[str],
) -> dict[str, Any] | None:
    """Create a maintenance block and link to affected track segments."""
    query = """
    CREATE (mb:MaintenanceBlock {
        block_id: $block_id,
        reason: $reason,
        start_time: datetime($start_time),
        end_time: datetime($end_time),
        status: $status
    })
    WITH mb
    UNWIND $affected_track_ids AS track_id
    MATCH (tr:TrackSegment {track_id: track_id})
    CREATE (mb)-[:AFFECTS]->(tr)
    SET tr.status = CASE WHEN $status = 'ACTIVE' THEN 'MAINTENANCE' ELSE tr.status END
    RETURN mb {
        .*,
        start_time: toString(mb.start_time),
        end_time: toString(mb.end_time),
        affected_tracks: $affected_track_ids
    } AS block
    """
    params = {
        "block_id": block_id,
        "reason": reason,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "status": status,
        "affected_track_ids": affected_track_ids,
    }
    result = await neo4j_manager.execute_write(query, params)
    return result[0]["block"] if result else None


async def get_active_maintenance_blocks() -> list[dict[str, Any]]:
    """Retrieve all currently active maintenance blocks."""
    query = """
    MATCH (mb:MaintenanceBlock)
    WHERE mb.status = 'ACTIVE'
    OPTIONAL MATCH (mb)-[:AFFECTS]->(tr:TrackSegment)
    WITH mb, collect(tr.track_id) AS affected_tracks
    RETURN mb {
        .*,
        start_time: toString(mb.start_time),
        end_time: toString(mb.end_time),
        affected_tracks: affected_tracks
    } AS block
    """
    result = await neo4j_manager.execute_read(query)
    return [record["block"] for record in result]


async def get_maintenance_affecting_train(
    train_number: str,
) -> list[dict[str, Any]]:
    """Find maintenance blocks affecting a train's current or planned route."""
    query = """
    MATCH (t:Train {train_number: $train_number})
    OPTIONAL MATCH (t)-[:CURRENTLY_ON|MOVING_TO]->(tr:TrackSegment)
    WITH t, collect(tr) AS train_tracks
    UNWIND train_tracks AS tr
    MATCH (mb:MaintenanceBlock)-[:AFFECTS]->(tr)
    WHERE mb.status = 'ACTIVE'
    RETURN DISTINCT mb {
        .*,
        start_time: toString(mb.start_time),
        end_time: toString(mb.end_time),
        affected_track: tr.track_id
    } AS block
    """
    result = await neo4j_manager.execute_read(query, {"train_number": train_number})
    return [record["block"] for record in result]


async def get_trains_affected_by_maintenance(
    block_id: str,
) -> list[dict[str, Any]]:
    """Find all trains affected by a specific maintenance block."""
    query = """
    MATCH (mb:MaintenanceBlock {block_id: $block_id})-[:AFFECTS]->(tr:TrackSegment)
    MATCH (tr)<-[:CURRENTLY_ON|MOVING_TO]-(t:Train)
    RETURN DISTINCT t {
        .*,
        last_updated: toString(t.last_updated),
        affected_track: tr.track_id
    } AS train
    """
    result = await neo4j_manager.execute_read(query, {"block_id": block_id})
    return [record["train"] for record in result if record.get("train") is not None]


async def update_maintenance_status(
    block_id: str,
    status: str,
) -> dict[str, Any] | None:
    """Update maintenance block status and restore track segments if completed."""
    query = """
    MATCH (mb:MaintenanceBlock {block_id: $block_id})
    OPTIONAL MATCH (mb)-[:AFFECTS]->(tr:TrackSegment)
    WITH mb, collect(tr) AS tracks
    SET mb.status = $status,
        mb.last_updated = datetime()
    FOREACH (tr IN tracks |
        SET tr.status = CASE WHEN $status IN ['COMPLETED', 'CANCELLED'] THEN 'ACTIVE' ELSE tr.status END
    )
    RETURN mb {
        .*,
        start_time: toString(mb.start_time),
        end_time: toString(mb.end_time),
        last_updated: toString(mb.last_updated),
        affected_tracks: [tr IN tracks | tr.track_id]
    } AS block
    """
    result = await neo4j_manager.execute_write(query, {"block_id": block_id, "status": status})
    return result[0]["block"] if result else None


async def get_upcoming_maintenance(
    hours_ahead: float = 24.0,
) -> list[dict[str, Any]]:
    """Find maintenance blocks scheduled to start within the next N hours."""
    query = """
    MATCH (mb:MaintenanceBlock)
    WHERE mb.status = 'SCHEDULED'
      AND mb.start_time <= datetime() + duration({hours: $hours_ahead})
    OPTIONAL MATCH (mb)-[:AFFECTS]->(tr:TrackSegment)
    WITH mb, collect(tr.track_id) AS affected_tracks
    RETURN mb {
        .*,
        start_time: toString(mb.start_time),
        end_time: toString(mb.end_time),
        affected_tracks: affected_tracks
    } AS block
    ORDER BY mb.start_time ASC
    """
    result = await neo4j_manager.execute_read(query, {"hours_ahead": hours_ahead})
    return [record["block"] for record in result]


async def get_maintenance_block_by_id(block_id: str) -> dict[str, Any] | None:
    """Retrieve a specific maintenance block by ID."""
    query = """
    MATCH (mb:MaintenanceBlock {block_id: $block_id})
    OPTIONAL MATCH (mb)-[:AFFECTS]->(tr:TrackSegment)
    WITH mb, collect(tr.track_id) AS affected_tracks
    RETURN mb {
        .*,
        start_time: toString(mb.start_time),
        end_time: toString(mb.end_time),
        affected_tracks: affected_tracks
    } AS block
    """
    result = await neo4j_manager.execute_read(query, {"block_id": block_id})
    return result[0]["block"] if result else None