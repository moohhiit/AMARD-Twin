"""
RailMind AI - Prediction Service.
Delay propagation, congestion estimation, and ETA calculations.
"""

from typing import Any

from backend.graph.train_queries import get_train_by_number
from backend.graph.neo4j_client import neo4j_manager
from backend.core.logger import get_logger

logger = get_logger("prediction_service")


class PredictionService:
    """Service for delay prediction and congestion estimation."""

    def __init__(self) -> None:
        pass

    async def predict_delays(
        self,
        train_number: str,
        lookahead_tracks: int = 5,
    ) -> dict[str, Any]:
        """Predict downstream delays for a train."""
        train = await get_train_by_number(train_number)
        if not train:
            raise ValueError(f"Train {train_number} not found")

        current_track = train.get("current_track")
        if not current_track:
            return {
                "train_number": train_number,
                "predictions": [],
                "reason": "no_current_track",
            }

        query = """
        MATCH (t:Train {train_number: $train_number})-[:CURRENTLY_ON]->(start:TrackSegment)
        MATCH path = (start)-[:CONNECTED_TO*1..$lookahead]->(tr:TrackSegment)
        WITH tr, reduce(d = 0.0, segment IN relationships(path) | d + segment.length_km) AS distance
        OPTIONAL MATCH (tr)<-[:AFFECTS]-(mb:MaintenanceBlock)
        WHERE mb.status = 'ACTIVE'
        OPTIONAL MATCH (tr)<-[:CURRENTLY_ON|MOVING_TO]-(other:Train)
        WHERE other.train_number <> $train_number
        RETURN tr.track_id AS track_id,
               distance,
               tr.speed_limit AS speed_limit,
               tr.status AS track_status,
               mb.block_id AS maintenance_block,
               other.train_number AS blocking_train,
               CASE WHEN mb IS NOT NULL THEN 15
                    WHEN other IS NOT NULL THEN 10
                    WHEN tr.status <> 'ACTIVE' THEN 20
                    ELSE 0 END AS estimated_delay_minutes
        ORDER BY distance
        """
        result = await neo4j_manager.execute_read(
            query,
            {
                "train_number": train_number,
                "lookahead": lookahead_tracks,
            },
        )

        predictions = []
        cumulative_delay = 0.0
        for record in result:
            delay = record["estimated_delay_minutes"]
            cumulative_delay += delay
            predictions.append(
                {
                    "track_id": record["track_id"],
                    "distance_km": round(record["distance"], 2),
                    "speed_limit": record["speed_limit"],
                    "track_status": record["track_status"],
                    "maintenance_block": record["maintenance_block"],
                    "blocking_train": record["blocking_train"],
                    "segment_delay_minutes": delay,
                    "cumulative_delay_minutes": round(cumulative_delay, 1),
                }
            )

        return {
            "train_number": train_number,
            "current_track": current_track,
            "lookahead_tracks": lookahead_tracks,
            "predictions": predictions,
            "total_predicted_delay_minutes": round(cumulative_delay, 1),
        }

    async def estimate_congestion(
        self,
        zone_id: str | None = None,
    ) -> dict[str, Any]:
        """Estimate congestion levels across zones or a specific zone."""
        if zone_id:
            query = """
            MATCH (z:Zone {zone_id: $zone_id})
            OPTIONAL MATCH (z)<-[:IN_ZONE]-(t:Train)
            OPTIONAL MATCH (z)<-[:PART_OF]-(tr:TrackSegment)
            RETURN z.zone_id AS zone_id,
                   z.name AS name,
                   z.occupancy_level AS occupancy_level,
                   z.congestion_level AS congestion_level,
                   z.risk_score AS risk_score,
                   count(t) AS train_count,
                   count(tr) AS track_count
            """
            params = {"zone_id": zone_id}
        else:
            query = """
            MATCH (z:Zone)
            OPTIONAL MATCH (z)<-[:IN_ZONE]-(t:Train)
            OPTIONAL MATCH (z)<-[:PART_OF]-(tr:TrackSegment)
            RETURN z.zone_id AS zone_id,
                   z.name AS name,
                   z.occupancy_level AS occupancy_level,
                   z.congestion_level AS congestion_level,
                   z.risk_score AS risk_score,
                   count(t) AS train_count,
                   count(tr) AS track_count
            ORDER BY z.congestion_level DESC
            """
            params = {}

        result = await neo4j_manager.execute_read(query, params)
        zones = [
            {
                "zone_id": r["zone_id"],
                "name": r["name"],
                "occupancy_level": r["occupancy_level"],
                "congestion_level": r["congestion_level"],
                "risk_score": r["risk_score"],
                "train_count": r["train_count"],
                "track_count": r["track_count"],
            }
            for r in result
        ]

        if zone_id:
            return {
                "zone_id": zone_id,
                "zone": zones[0] if zones else None,
            }

        avg_congestion = (
            sum(z["congestion_level"] for z in zones) / len(zones)
            if zones
            else 0
        )
        return {
            "zones": zones,
            "zone_count": len(zones),
            "average_congestion_level": round(avg_congestion, 2),
            "highest_congestion_zone": zones[0] if zones else None,
        }

    async def get_eta(
        self,
        train_number: str,
        destination_track_id: str,
    ) -> dict[str, Any]:
        """Calculate estimated time of arrival to a destination track."""
        train = await get_train_by_number(train_number)
        if not train:
            raise ValueError(f"Train {train_number} not found")

        current_track = train.get("current_track")
        speed = train.get("speed", 0)
        if not current_track or speed <= 0:
            return {
                "train_number": train_number,
                "destination": destination_track_id,
                "eta_minutes": None,
                "reason": "train_stationary_or_no_track",
            }

        query = """
        MATCH (start:TrackSegment {track_id: $start})
        MATCH (end:TrackSegment {track_id: $end})
        MATCH path = shortestPath((start)-[:CONNECTED_TO*]->(end))
        RETURN reduce(total = 0.0, tr IN nodes(path) | total + tr.length_km) AS total_distance,
               [tr IN nodes(path) | tr.track_id] AS path_tracks
        """
        result = await neo4j_manager.execute_read(
            query,
            {"start": current_track, "end": destination_track_id},
        )

        if not result:
            return {
                "train_number": train_number,
                "destination": destination_track_id,
                "eta_minutes": None,
                "reason": "no_path_found",
            }

        distance = result[0]["total_distance"]
        eta_minutes = (distance / speed) * 60.0

        return {
            "train_number": train_number,
            "current_track": current_track,
            "destination": destination_track_id,
            "distance_km": round(distance, 2),
            "current_speed": speed,
            "eta_minutes": round(eta_minutes, 1),
            "path_tracks": result[0]["path_tracks"],
        }