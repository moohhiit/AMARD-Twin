"""
RailMind AI - Route Search & Traversal Graph Queries.
Cypher queries for shortest path, route reservation, and junction configuration.
"""

from typing import Any

from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("route_queries")


async def create_route(
    route_id: str,
    name: str,
    route_type: str,
    priority: int,
) -> dict[str, Any] | None:
    """Create a new Route node."""
    query = """
    CREATE (r:Route {
        route_id: $route_id,
        name: $name,
        type: $type,
        priority: $priority
    })
    RETURN r AS route
    """
    params = {"route_id": route_id, "name": name, "type": route_type, "priority": priority}
    result = await neo4j_manager.execute_write(query, params)
    return result[0]["route"] if result else None


async def get_route_by_id(route_id: str) -> dict[str, Any] | None:
    """Retrieve a route by ID."""
    query = """
    MATCH (r:Route {route_id: $route_id})
    RETURN r AS route
    """
    result = await neo4j_manager.execute_read(query, {"route_id": route_id})
    return result[0]["route"] if result else None


async def find_shortest_valid_route(
    start_track_id: str,
    end_track_id: str,
    min_speed_limit: float = 0.0,
) -> list[dict[str, Any]]:
    """
    Find shortest valid path between two track segments using CONNECTED_TO.
    Respects speed limits and track status.
    """
    query = """
    MATCH (start:TrackSegment {track_id: $start_track_id})
    MATCH (end:TrackSegment {track_id: $end_track_id})
    MATCH path = shortestPath((start)-[:CONNECTED_TO*]->(end))
    WHERE ALL(tr IN nodes(path) WHERE tr.status IN ['ACTIVE', 'OPERATIONAL'] AND tr.speed_limit >= $min_speed_limit)
      AND NONE(tr IN nodes(path) WHERE EXISTS {
          MATCH (tr)<-[:AFFECTS]-(mb:MaintenanceBlock)
          WHERE mb.status = 'ACTIVE'
      })
    RETURN [tr IN nodes(path) | tr.track_id] AS track_sequence,
           [tr IN nodes(path) | {
               track_id: tr.track_id,
               length_km: tr.length_km,
               speed_limit: tr.speed_limit,
               status: tr.status
           }] AS track_details,
           reduce(total = 0.0, tr IN nodes(path) | total + tr.length_km) AS total_distance,
           length(path) AS hop_count
    """
    params = {
        "start_track_id": start_track_id,
        "end_track_id": end_track_id,
        "min_speed_limit": min_speed_limit,
    }
    result = await neo4j_manager.execute_read(query, params)
    return [
        {
            "track_sequence": record["track_sequence"],
            "track_details": record["track_details"],
            "total_distance": record["total_distance"],
            "hop_count": record["hop_count"],
        }
        for record in result
    ]


async def find_all_paths_with_junctions(
    start_track_id: str,
    end_track_id: str,
    max_hops: int = 10,
) -> list[dict[str, Any]]:
    """
    Find all valid paths up to max_hops, including junction traversal.
    Used for route allocation with junction configuration.
    """
    query = """
    MATCH (start:TrackSegment {track_id: $start_track_id})
    MATCH (end:TrackSegment {track_id: $end_track_id})
    MATCH path = (start)-[:CONNECTED_TO*1..$max_hops]->(end)
    WHERE ALL(tr IN nodes(path) WHERE tr.status IN ['ACTIVE', 'OPERATIONAL'])
      AND NONE(tr IN nodes(path) WHERE EXISTS {
          MATCH (tr)<-[:AFFECTS]-(mb:MaintenanceBlock)
          WHERE mb.status = 'ACTIVE'
      })
    RETURN [tr IN nodes(path) | tr.track_id] AS track_sequence,
           [j IN nodes(path) WHERE j:Junction | {
               junction_id: j.junction_id,
               name: j.name,
               status: j.status
           }] AS junctions,
           reduce(total = 0.0, tr IN nodes(path) | total + tr.length_km) AS total_distance
    ORDER BY total_distance ASC
    LIMIT 5
    """
    params = {
        "start_track_id": start_track_id,
        "end_track_id": end_track_id,
        "max_hops": max_hops,
    }
    result = await neo4j_manager.execute_read(query, params)
    return [
        {
            "track_sequence": record["track_sequence"],
            "junctions": record["junctions"],
            "total_distance": record["total_distance"],
        }
        for record in result
    ]


async def reserve_route(
    route_id: str,
    train_number: str,
    track_sequence: list[str],
) -> bool:
    """
    Reserve a route by creating relationships and marking tracks.
    Uses locking pattern to prevent double-booking.
    """
    query = """
    MATCH (t:Train {train_number: $train_number})
    MATCH (r:Route {route_id: $route_id})
    WITH t, r
    UNWIND $track_sequence AS track_id
    MATCH (tr:TrackSegment {track_id: track_id})
    WHERE tr.status IN ['ACTIVE', 'OPERATIONAL']
      AND NOT EXISTS {
          MATCH (other:Train)-[:CURRENTLY_ON|MOVING_TO]->(tr)
          WHERE other.train_number <> $train_number
      }
    WITH t, r, collect(tr) AS tracks
    FOREACH (tr IN tracks |
        CREATE (t)-[:MOVING_TO]->(tr)
    )
    SET t.route_id = $route_id,
        t.next_track = $track_sequence[1],
        t.last_updated = datetime()
    RETURN size(tracks) AS reserved_count
    """
    params = {
        "route_id": route_id,
        "train_number": train_number,
        "track_sequence": track_sequence,
    }
    result = await neo4j_manager.execute_write(query, params)
    if result and result[0]["reserved_count"] == len(track_sequence):
        logger.info(
            "route_reserved",
            route_id=route_id,
            train_number=train_number,
            track_count=len(track_sequence),
        )
        return True
    return False


async def clear_route_reservation(train_number: str) -> bool:
    """Remove all MOVING_TO relationships for a train."""
    query = """
    MATCH (t:Train {train_number: $train_number})
    OPTIONAL MATCH (t)-[r:MOVING_TO]->(:TrackSegment)
    DELETE r
    SET t.next_track = null
    RETURN count(r) AS cleared_count
    """
    result = await neo4j_manager.execute_write(query, {"train_number": train_number})
    return True


async def get_route_conflicts(route_id: str) -> list[dict[str, Any]]:
    """Find trains that share track segments with a given route reservation."""
    query = """
    MATCH (r:Route {route_id: $route_id})<-[:FOLLOWS_ROUTE]-(t:Train)
    MATCH (t)-[:MOVING_TO|CURRENTLY_ON]->(tr:TrackSegment)
    MATCH (other:Train)-[:MOVING_TO|CURRENTLY_ON]->(tr)
    WHERE other.train_number <> t.train_number
    RETURN DISTINCT {
        track_id: tr.track_id,
        train_number: t.train_number,
        conflicting_train: other.train_number,
        conflict_type: 'ROUTE_OVERLAP'
    } AS conflict
    """
    result = await neo4j_manager.execute_read(query, {"route_id": route_id})
    return [record["conflict"] for record in result]


async def get_routes_through_junction(junction_id: str) -> list[dict[str, Any]]:
    """Find all routes that traverse a specific junction."""
    query = """
    MATCH (j:Junction {junction_id: $junction_id})-[:CONNECTS]->(tr:TrackSegment)
    MATCH (t:Train)-[:CURRENTLY_ON|MOVING_TO]->(tr)
    OPTIONAL MATCH (t)-[:FOLLOWS_ROUTE]->(r:Route)
    RETURN DISTINCT {
        train_number: t.train_number,
        route_id: r.route_id,
        track_id: tr.track_id,
        direction: t.direction
    } AS route_usage
    """
    result = await neo4j_manager.execute_read(query, {"junction_id": junction_id})
    return [record["route_usage"] for record in result]


async def configure_junction_for_route(
    junction_id: str,
    entry_track_id: str,
    exit_track_id: str,
    status: str = "CONFIGURED",
) -> dict[str, Any] | None:
    """Configure a junction to connect specific entry and exit tracks."""
    query = """
    MATCH (j:Junction {junction_id: $junction_id})
    MATCH (entry:TrackSegment {track_id: $entry_track_id})
    MATCH (exit:TrackSegment {track_id: $exit_track_id})
    WHERE (j)-[:CONNECTS]->(entry) AND (j)-[:CONNECTS]->(exit)
    SET j.status = $status,
        j.configured_entry = $entry_track_id,
        j.configured_exit = $exit_track_id,
        j.last_configured = datetime()
    RETURN j {
        .*,
        last_configured: toString(j.last_configured)
    } AS junction
    """
    params = {
        "junction_id": junction_id,
        "entry_track_id": entry_track_id,
        "exit_track_id": exit_track_id,
        "status": status,
    }
    result = await neo4j_manager.execute_write(query, params)
    return result[0]["junction"] if result else None