"""
RailMind AI - Conflict Detection Graph Queries.
Cypher queries for route, junction, and track occupancy conflict detection.
"""

from typing import Any

from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("conflict_queries")


async def detect_track_occupancy_conflicts() -> list[dict[str, Any]]:
    """Detect multiple trains occupying the same track segment."""
    query = """
    MATCH (tr:TrackSegment)
    MATCH (tr)<-[:CURRENTLY_ON]-(t:Train)
    WITH tr, collect(t) AS trains, count(t) AS train_count
    WHERE train_count > 1
    RETURN {
        conflict_type: 'TRACK_OCCUPANCY',
        track_id: tr.track_id,
        train_count: train_count,
        trains: [t IN trains | {
            train_number: t.train_number,
            direction: t.direction,
            speed: t.speed
        }],
        severity: CASE WHEN train_count > 2 THEN 'CRITICAL' ELSE 'HIGH' END
    } AS conflict
    """
    result = await neo4j_manager.execute_read(query)
    return [record["conflict"] for record in result]


async def detect_route_conflicts() -> list[dict[str, Any]]:
    """Detect trains with overlapping MOVING_TO routes."""
    query = """
    MATCH (t1:Train)-[:MOVING_TO]->(tr:TrackSegment)<-[:MOVING_TO]-(t2:Train)
    WHERE t1.train_number < t2.train_number
    RETURN {
        conflict_type: 'ROUTE_OVERLAP',
        track_id: tr.track_id,
        train_a: t1.train_number,
        train_b: t2.train_number,
        direction_a: t1.direction,
        direction_b: t2.direction,
        severity: CASE WHEN t1.direction <> t2.direction THEN 'CRITICAL' ELSE 'HIGH' END
    } AS conflict
    """
    result = await neo4j_manager.execute_read(query)
    return [record["conflict"] for record in result]


async def detect_junction_conflicts() -> list[dict[str, Any]]:
    """Detect junctions with conflicting train movements."""
    query = """
    MATCH (j:Junction)-[:CONNECTS]->(tr:TrackSegment)
    MATCH (tr)<-[:CURRENTLY_ON|MOVING_TO]-(t:Train)
    WITH j, collect(DISTINCT t) AS trains, count(DISTINCT t) AS train_count
    WHERE train_count > 1
    RETURN {
        conflict_type: 'JUNCTION_CONFLICT',
        junction_id: j.junction_id,
        junction_name: j.name,
        train_count: train_count,
        trains: [t IN trains | {
            train_number: t.train_number,
            direction: t.direction,
            current_track: t.current_track,
            next_track: t.next_track
        }],
        severity: CASE WHEN train_count > 2 THEN 'CRITICAL' ELSE 'HIGH' END,
        conflict_risk_score: j.conflict_risk_score
    } AS conflict
    """
    result = await neo4j_manager.execute_read(query)
    return [record["conflict"] for record in result]


async def detect_headway_conflicts(min_safe_distance_km: float = 1.0) -> list[dict[str, Any]]:
    """Detect trains that are too close on the same track/route."""
    query = """
    MATCH (t1:Train)-[:CURRENTLY_ON]->(tr:TrackSegment)
    MATCH (t2:Train)-[:CURRENTLY_ON]->(tr)
    WHERE t1.train_number < t2.train_number
    AND t1.direction = t2.direction
    WITH t1, t2, tr,
         abs(t1.progress_on_track - t2.progress_on_track) * tr.length_km / 100.0 AS distance_km
    WHERE distance_km < $min_safe_distance_km
    RETURN {
        conflict_type: 'HEADWAY_VIOLATION',
        track_id: tr.track_id,
        train_a: t1.train_number,
        train_b: t2.train_number,
        distance_km: distance_km,
        direction: t1.direction,
        severity: CASE WHEN distance_km < 0.5 THEN 'CRITICAL' ELSE 'HIGH' END
    } AS conflict
    """
    result = await neo4j_manager.execute_read(query, {"min_safe_distance_km": min_safe_distance_km})
    return [record["conflict"] for record in result]


async def detect_loop_line_conflicts() -> list[dict[str, Any]]:
    """Detect conflicts on loop lines where slower trains should be diverted."""
    query = """
    MATCH (t1:Train)-[:CURRENTLY_ON]->(tr:TrackSegment)
    MATCH (t2:Train)-[:CURRENTLY_ON]->(tr)
    WHERE t1.train_number < t2.train_number
    AND t1.speed <> t2.speed
    RETURN {
        conflict_type: 'LOOP_LINE_PRIORITY',
        track_id: tr.track_id,
        faster_train: CASE WHEN t1.speed > t2.speed THEN t1.train_number ELSE t2.train_number END,
        slower_train: CASE WHEN t1.speed > t2.speed THEN t2.train_number ELSE t1.train_number END,
        speed_difference: abs(t1.speed - t2.speed),
        severity: 'MEDIUM'
    } AS conflict
    """
    result = await neo4j_manager.execute_read(query)
    return [record["conflict"] for record in result]


async def get_all_active_conflicts() -> list[dict[str, Any]]:
    """Aggregate all active conflicts in the network."""
    query = """
    CALL {
        MATCH (tr:TrackSegment)<-[:CURRENTLY_ON]-(t:Train)
        WITH tr, collect(t) AS trains, count(t) AS train_count
        WHERE train_count > 1
        RETURN {
            conflict_type: 'TRACK_OCCUPANCY',
            track_id: tr.track_id,
            trains: [t IN trains | t.train_number],
            severity: CASE WHEN train_count > 2 THEN 'CRITICAL' ELSE 'HIGH' END
        } AS conflict
    UNION
        MATCH (t1:Train)-[:MOVING_TO]->(tr:TrackSegment)<-[:MOVING_TO]-(t2:Train)
        WHERE t1.train_number < t2.train_number
        RETURN {
            conflict_type: 'ROUTE_OVERLAP',
            track_id: tr.track_id,
            trains: [t1.train_number, t2.train_number],
            severity: CASE WHEN t1.direction <> t2.direction THEN 'CRITICAL' ELSE 'HIGH' END
        } AS conflict
    UNION
        MATCH (j:Junction)-[:CONNECTS]->(tr:TrackSegment)
        MATCH (tr)<-[:CURRENTLY_ON|MOVING_TO]-(t:Train)
        WITH j, collect(DISTINCT t) AS trains, count(DISTINCT t) AS train_count
        WHERE train_count > 1
        RETURN {
            conflict_type: 'JUNCTION_CONFLICT',
            junction_id: j.junction_id,
            trains: [t IN trains | t.train_number],
            severity: CASE WHEN train_count > 2 THEN 'CRITICAL' ELSE 'HIGH' END
        } AS conflict
    }
    RETURN conflict
    """
    result = await neo4j_manager.execute_read(query)
    return [record["conflict"] for record in result]


async def get_conflict_history_for_train(
    train_number: str,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Retrieve historical events involving a specific train."""
    query = """
    MATCH (e:Event)-[:INVOLVES]->(t:Train {train_number: $train_number})
    OPTIONAL MATCH (e)-[:AFFECTS]->(tr:TrackSegment)
    RETURN e {
        .*,
        timestamp: toString(e.timestamp),
        affected_track: tr.track_id
    } AS event
    ORDER BY e.timestamp DESC
    LIMIT $limit
    """
    result = await neo4j_manager.execute_read(query, {"train_number": train_number, "limit": limit})
    return [record["event"] for record in result]