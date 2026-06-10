"""
RailMind AI - Platform Allocation Graph Queries.
Cypher queries for platform discovery, matching, and assignment.
"""

from typing import Any

from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("platform_queries")


async def create_platform(
    platform_id: str,
    platform_number: str,
    name: str,
    status: str,
    length_m: float,
    station_id: str,
) -> dict[str, Any] | None:
    """Create a new Platform node linked to a Station."""
    query = """
    CREATE (p:Platform {
        platform_id: $platform_id,
        platform_number: $platform_number,
        name: $name,
        status: $status,
        length_m: $length_m
    })
    WITH p
    MATCH (s:Station {station_id: $station_id})
    CREATE (s)-[:HAS_PLATFORM]->(p)
    RETURN p {
        .*,
        station_id: s.station_id
    } AS platform
    """
    params = {
        "platform_id": platform_id,
        "platform_number": platform_number,
        "name": name,
        "status": status,
        "length_m": length_m,
        "station_id": station_id,
    }
    result = await neo4j_manager.execute_write(query, params)
    return result[0]["platform"] if result else None


async def get_platform_by_id(platform_id: str) -> dict[str, Any] | None:
    """Retrieve a platform by its unique ID."""
    query = """
    MATCH (p:Platform {platform_id: $platform_id})
    OPTIONAL MATCH (p)<-[:HAS_PLATFORM]-(s:Station)
    RETURN p {
        .*,
        station_name: s.name
    } AS platform
    """
    result = await neo4j_manager.execute_read(query, {"platform_id": platform_id})
    return result[0]["platform"] if result else None


async def get_free_platforms_at_station(
    station_id: str,
    min_length_m: float,
) -> list[dict[str, Any]]:
    """Find available platforms at a station that can accommodate train length."""
    query = """
    MATCH (s:Station {station_id: $station_id})-[:HAS_PLATFORM]->(p:Platform)
    WHERE p.status = 'FREE' AND p.length_m >= $min_length_m
    OPTIONAL MATCH (p)-[:CONNECTED_TO]->(tr:TrackSegment)
    OPTIONAL MATCH (p)<-[:AT_PLATFORM]-(t:Train)
    RETURN p {
        .*,
        connected_track: tr.track_id,
        occupied_by: t.train_number
    } AS platform
    ORDER BY p.length_m ASC
    """
    params = {"station_id": station_id, "min_length_m": min_length_m}
    result = await neo4j_manager.execute_read(query, params)
    return [record["platform"] for record in result]


async def get_all_platforms() -> list[dict[str, Any]]:
    """Retrieve all platforms with station and occupancy info."""
    query = """
    MATCH (s:Station)-[:HAS_PLATFORM]->(p:Platform)
    OPTIONAL MATCH (p)<-[:AT_PLATFORM]-(t:Train)
    OPTIONAL MATCH (p)-[:CONNECTED_TO]->(tr:TrackSegment)
    RETURN p {
        .*,
        station_id: s.station_id,
        station_name: s.name,
        occupied_by: t.train_number,
        connected_track: tr.track_id
    } AS platform
    """
    result = await neo4j_manager.execute_read(query)
    return [record["platform"] for record in result]


async def assign_platform_to_train(
    train_number: str,
    platform_id: str,
) -> dict[str, Any] | None:
    """Assign a train to a platform and update platform status."""
    query = """
    MATCH (t:Train {train_number: $train_number})
    MATCH (p:Platform {platform_id: $platform_id})
    WHERE p.status = 'FREE'
    OPTIONAL MATCH (t)-[r:AT_PLATFORM]->(:Platform)
    DELETE r
    WITH t, p
    CREATE (t)-[:AT_PLATFORM]->(p)
    SET p.status = 'OCCUPIED',
        t.current_platform = p.platform_id,
        t.last_updated = datetime()
    RETURN p {
        .*,
        assigned_train: t.train_number
    } AS platform
    """
    params = {"train_number": train_number, "platform_id": platform_id}
    result = await neo4j_manager.execute_write(query, params)
    return result[0]["platform"] if result else None


async def release_platform(platform_id: str) -> dict[str, Any] | None:
    """Free a platform and remove train relationship."""
    query = """
    MATCH (p:Platform {platform_id: $platform_id})
    OPTIONAL MATCH (t:Train)-[r:AT_PLATFORM]->(p)
    DELETE r
    SET p.status = 'FREE'
    WITH p
    OPTIONAL MATCH (p)<-[:AT_PLATFORM]-(remaining:Train)
    RETURN p {
        .*,
        still_occupied_by: remaining.train_number
    } AS platform
    """
    result = await neo4j_manager.execute_write(query, {"platform_id": platform_id})
    return result[0]["platform"] if result else None


async def get_platforms_by_maintenance_status(
    status: str,
) -> list[dict[str, Any]]:
    """Find platforms affected by maintenance blocks."""
    query = """
    MATCH (p:Platform)-[:CONNECTED_TO]->(tr:TrackSegment)<-[:AFFECTS]-(mb:MaintenanceBlock)
    WHERE mb.status = $status
    RETURN DISTINCT p {
        .*,
        block_id: mb.block_id,
        block_reason: mb.reason,
        block_start: toString(mb.start_time),
        block_end: toString(mb.end_time)
    } AS platform
    """
    result = await neo4j_manager.execute_read(query, {"status": status})
    return [record["platform"] for record in result]


async def find_best_platform_for_train(
    train_number: str,
    station_id: str,
) -> dict[str, Any] | None:
    """Find the optimal platform for a train considering length, maintenance, and connectivity."""
    query = """
    MATCH (t:Train {train_number: $train_number})
    MATCH (s:Station {station_id: $station_id})-[:HAS_PLATFORM]->(p:Platform)
    WHERE p.status = 'FREE'
      AND p.length_m >= t.train_length_m
      AND NOT EXISTS {
          MATCH (p)-[:CONNECTED_TO]->(tr:TrackSegment)<-[:AFFECTS]-(mb:MaintenanceBlock)
          WHERE mb.status = 'ACTIVE'
      }
    OPTIONAL MATCH (p)-[:CONNECTED_TO]->(tr:TrackSegment)
    RETURN p {
        .*,
        connected_track: tr.track_id,
        suitability_score: (p.length_m - t.train_length_m)
    } AS platform
    ORDER BY suitability_score ASC
    LIMIT 1
    """
    params = {"train_number": train_number, "station_id": station_id}
    result = await neo4j_manager.execute_read(query, params)
    return result[0]["platform"] if result else None