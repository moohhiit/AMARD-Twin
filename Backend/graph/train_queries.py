"""
RailMind AI - Train Graph Queries.
Cypher queries for train CRUD, position tracking, and state management.
"""

from typing import Any

from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("train_queries")


async def create_train(
    train_number: str,
    name: str,
    status: str,
    speed: float,
    direction: str,
    current_track: str,
    next_track: str | None,
    route_id: str,
    progress_on_track: float,
    train_length_m: float,
    current_platform: str | None,
) -> dict[str, Any] | None:
    """Create a new Train node with all properties."""
    query = """
    CREATE (t:Train {
        train_number: $train_number,
        name: $name,
        status: $status,
        speed: $speed,
        direction: $direction,
        current_track: $current_track,
        next_track: $next_track,
        route_id: $route_id,
        progress_on_track: $progress_on_track,
        last_updated: datetime(),
        train_length_m: $train_length_m,
        current_platform: $current_platform
    })
    RETURN t {
        .*,
        last_updated: toString(t.last_updated)
    } AS train
    """
    params = {
        "train_number": train_number,
        "name": name,
        "status": status,
        "speed": speed,
        "direction": direction,
        "current_track": current_track,
        "next_track": next_track,
        "route_id": route_id,
        "progress_on_track": progress_on_track,
        "train_length_m": train_length_m,
        "current_platform": current_platform,
    }
    result = await neo4j_manager.execute_write(query, params)
    return result[0]["train"] if result else None


async def get_train_by_number(train_number: str) -> dict[str, Any] | None:
    """Retrieve a single train by its unique train number."""
    query = """
    MATCH (t:Train {train_number: $train_number})
    RETURN t {
        .*,
        last_updated: toString(t.last_updated)
    } AS train
    """
    result = await neo4j_manager.execute_read(query, {"train_number": train_number})
    return result[0]["train"] if result else None


async def get_all_trains() -> list[dict[str, Any]]:
    """Retrieve all trains with their current track and zone relationships."""
    query = """
    MATCH (t:Train)
    OPTIONAL MATCH (t)-[:CURRENTLY_ON]->(tr:TrackSegment)
    OPTIONAL MATCH (t)-[:IN_ZONE]->(z:Zone)
    OPTIONAL MATCH (t)-[:FOLLOWS_ROUTE]->(r:Route)
    RETURN t {
        .*,
        last_updated: toString(t.last_updated)
    } AS train,
    tr.track_id AS current_track_id,
    z.zone_id AS zone_id,
    r.route_id AS route_id
    """
    result = await neo4j_manager.execute_read(query)
    return [
        {
            **record["train"],
            "current_track_id": record["current_track_id"],
            "zone_id": record["zone_id"],
            "route_id": record["route_id"],
        }
        for record in result
    ]


async def update_train_position(
    train_number: str,
    current_track: str,
    next_track: str | None,
    progress_on_track: float,
    speed: float,
    status: str,
) -> dict[str, Any] | None:
    """Update train position, speed, and status. Update relationships."""
    query = """
    MATCH (t:Train {train_number: $train_number})
    OPTIONAL MATCH (t)-[r:CURRENTLY_ON]->(oldTrack:TrackSegment)
    DELETE r
    WITH t
    MATCH (newTrack:TrackSegment {track_id: $current_track})
    CREATE (t)-[:CURRENTLY_ON]->(newTrack)
    SET t.current_track = $current_track,
        t.next_track = $next_track,
        t.progress_on_track = $progress_on_track,
        t.speed = $speed,
        t.status = $status,
        t.last_updated = datetime()
    RETURN t {
        .*,
        last_updated: toString(t.last_updated)
    } AS train
    """
    params = {
        "train_number": train_number,
        "current_track": current_track,
        "next_track": next_track,
        "progress_on_track": progress_on_track,
        "speed": speed,
        "status": status,
    }
    result = await neo4j_manager.execute_write(query, params)
    return result[0]["train"] if result else None


async def update_train_route(
    train_number: str,
    route_id: str,
) -> dict[str, Any] | None:
    """Update the route relationship for a train."""
    query = """
    MATCH (t:Train {train_number: $train_number})
    OPTIONAL MATCH (t)-[r:FOLLOWS_ROUTE]->(:Route)
    DELETE r
    WITH t
    MATCH (newRoute:Route {route_id: $route_id})
    CREATE (t)-[:FOLLOWS_ROUTE]->(newRoute)
    SET t.route_id = $route_id,
        t.last_updated = datetime()
    RETURN t {
        .*,
        last_updated: toString(t.last_updated)
    } AS train
    """
    result = await neo4j_manager.execute_write(
        query, {"train_number": train_number, "route_id": route_id}
    )
    return result[0]["train"] if result else None


async def update_train_zone(
    train_number: str,
    zone_id: str,
) -> dict[str, Any] | None:
    """Update the zone relationship for a train."""
    query = """
    MATCH (t:Train {train_number: $train_number})
    OPTIONAL MATCH (t)-[r:IN_ZONE]->(:Zone)
    DELETE r
    WITH t
    MATCH (newZone:Zone {zone_id: $zone_id})
    CREATE (t)-[:IN_ZONE]->(newZone)
    SET t.last_updated = datetime()
    RETURN t {
        .*,
        last_updated: toString(t.last_updated)
    } AS train
    """
    result = await neo4j_manager.execute_write(
        query, {"train_number": train_number, "zone_id": zone_id}
    )
    return result[0]["train"] if result else None


async def delete_train(train_number: str) -> bool:
    """Delete a train node and all its relationships."""
    query = """
    MATCH (t:Train {train_number: $train_number})
    DETACH DELETE t
    """
    result = await neo4j_manager.execute_write(query, {"train_number": train_number})
    return len(result) >= 0


async def get_train_full_graph(train_number: str) -> dict[str, Any] | None:
    """Retrieve a train with all connected nodes (track, zone, route, platform)."""
    query = """
    MATCH (t:Train {train_number: $train_number})
    OPTIONAL MATCH (t)-[:CURRENTLY_ON]->(tr:TrackSegment)
    OPTIONAL MATCH (t)-[:MOVING_TO]->(nextTr:TrackSegment)
    OPTIONAL MATCH (t)-[:IN_ZONE]->(z:Zone)
    OPTIONAL MATCH (t)-[:FOLLOWS_ROUTE]->(r:Route)
    OPTIONAL MATCH (t)-[:AT_PLATFORM]->(p:Platform)
    RETURN t {
        .*,
        last_updated: toString(t.last_updated)
    } AS train,
    tr AS current_track,
    nextTr AS next_track,
    z AS zone,
    r AS route,
    p AS platform
    """
    result = await neo4j_manager.execute_read(query, {"train_number": train_number})
    if not result:
        return None
    record = result[0]
    return {
        "train": record["train"],
        "current_track": record["current_track"],
        "next_track": record["next_track"],
        "zone": record["zone"],
        "route": record["route"],
        "platform": record["platform"],
    }


async def get_trains_on_track(track_id: str) -> list[dict[str, Any]]:
    """Find all trains currently occupying a specific track segment."""
    query = """
    MATCH (t:Train)-[:CURRENTLY_ON]->(tr:TrackSegment {track_id: $track_id})
    RETURN t {
        .*,
        last_updated: toString(t.last_updated)
    } AS train
    """
    result = await neo4j_manager.execute_read(query, {"track_id": track_id})
    return [record["train"] for record in result]