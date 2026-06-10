from fastapi import FastAPI, HTTPException, BackgroundTasks
from neo4j import GraphDatabase, Driver
from platform_agent import PlatformAllocationAgent
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from route_agent import RouteAllocationAgent
import os

app = FastAPI(title="AMARD TWIN - Railway Digital Twin API")

# Neo4j Configuration
NEO4J_URI = os.getenv("NEO4J_URI", "neo4j+s://fcde3b36.databases.neo4j.io")
NEO4J_USER = os.getenv("NEO4J_USER", "fcde3b36")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "1g199KCNbB3DbI3mXlIcoROtLO09Gq7e1i7-vcjzJLg")

# Initialize driver
driver: Driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

platform_agent = PlatformAllocationAgent(driver)
route_agent = RouteAllocationAgent(driver)

class PlatformAllocateRequest(BaseModel):
    train_number: str

class PlatformReallocateRequest(BaseModel):
    train_number: str
    force_platform_id: Optional[str] = None
def get_db():
    return driver.session()

# ============ MODELS ============

class TrainPositionUpdate(BaseModel):
    train_number: str
    current_track: str
    next_track: str
    progress: float = Field(..., ge=0.0, le=1.0)
    speed: float = Field(..., ge=0.0)

class ConflictAlert(BaseModel):
    location: str
    location_type: str
    conflict: str
    severity: Literal["DANGER", "WARNING", "CAUTION"]
    involved_trains: List[str]
    detected_at: datetime


class RouteOption(BaseModel):
    start: str
    end: str
    distance_km: float
    tracks: List[str]
    safety_rating: str
    
class PlatformInfo(BaseModel):
    platform_id: str
    platform_number: str
    platform_name: str
    platform_status: str
    platform_length_m: int

class TrainLocation(BaseModel):
    train_number: str
    train_name: str
    status: str
    speed: float
    direction: str
    station: str
    zone: str
    current_track: str
    next_track: str
    platform: Optional[PlatformInfo] = None   # <-- ADD THIS
    progress_percentage: float
    conflict_status: Literal["SAFE", "WARNING", "DANGER"]
    conflicts: List[str]
    
class RouteAllocateRequest(BaseModel):
    train_number: str
    target_platform_id: str

class RouteUnlockRequest(BaseModel):
    train_number: str

# ============ API ENDPOINTS ============

# ═══════════════════════════════════════════════════════════════
# PLATFORM ALLOCATION AGENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.post("/api/platform/allocate")
async def allocate_platform(request: PlatformAllocateRequest):
    """
    Autonomous Platform Allocation Agent.
    Runs full LangGraph workflow: load train → find platforms → score → detect conflicts → allocate.
    """
    result = platform_agent.run(request.train_number)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/api/platform/reallocate")
async def reallocate_platform(request: PlatformReallocateRequest):
    """
    Force reallocation. If force_platform_id provided, assigns directly.
    Otherwise runs the agent again after releasing current platform.
    """
    result = platform_agent.reallocate(request.train_number, request.force_platform_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.get("/api/platform/status")
async def platform_status():
    """Real-time platform occupancy across all stations"""
    with get_db() as session:
        result = session.run("""
            MATCH (s:Station)-[:HAS_PLATFORM]->(p:Platform)
            OPTIONAL MATCH (tr:Train)-[:AT_PLATFORM]->(p)
            RETURN {
                station_id: s.station_id,
                station_name: s.name,
                platform_id: p.platform_id,
                platform_number: p.platform_number,
                name: p.name,
                status: p.status,
                length_m: p.length_m,
                occupied_by: tr.train_number,
                train_name: tr.name,
                train_length_m: tr.train_length_m
            } AS platform
            ORDER BY s.station_id, p.platform_number
        """)
        return [record["platform"] for record in result]

@app.get("/api/platform/allocations")
async def platform_allocations():
    """All active train-to-platform allocations"""
    with get_db() as session:
        result = session.run("""
            MATCH (tr:Train)-[:AT_PLATFORM]->(p:Platform)-[:HAS_PLATFORM]-(s:Station)
            RETURN {
                train_number: tr.train_number,
                train_name: tr.name,
                platform_id: p.platform_id,
                platform_name: p.name,
                station_name: s.name,
                allocated_at: tr.last_updated
            } AS allocation
        """)
        return [record["allocation"] for record in result]

@app.get("/api/platform/conflicts")
async def platform_conflicts():
    """Active platform-level conflicts detected by the agent"""
    with get_db() as session:
        result = session.run("""
            MATCH (t1:Train)-[:AT_PLATFORM]->(p:Platform)<-[:AT_PLATFORM]-(t2:Train)
            WHERE t1.train_number < t2.train_number
            RETURN {
                conflict_type: 'PLATFORM_DOUBLE_OCCUPANCY',
                platform_id: p.platform_id,
                platform_name: p.name,
                train_1: t1.train_number,
                train_2: t2.train_number,
                severity: 'DANGER'
            } AS conflict
            UNION
            MATCH (tr:Train)-[:AT_PLATFORM]->(p:Platform)
            WHERE tr.train_length_m > p.length_m
            RETURN {
                conflict_type: 'TRAIN_EXCEEDS_PLATFORM',
                platform_id: p.platform_id,
                platform_name: p.name,
                train: tr.train_number,
                train_length: tr.train_length_m,
                platform_length: p.length_m,
                severity: 'WARNING'
            } AS conflict
            UNION
            MATCH (tr:Train)-[:AT_PLATFORM]->(p:Platform)
            WHERE tr.status = 'RUNNING'
            RETURN {
                conflict_type: 'RUNNING_TRAIN_AT_PLATFORM',
                platform_id: p.platform_id,
                platform_name: p.name,
                train: tr.train_number,
                severity: 'WARNING'
            } AS conflict
        """)
        return [record["conflict"] for record in result]
      
@app.post("/api/route/allocate")
async def allocate_route(request: RouteAllocateRequest):
    """
    Agent 2: Route Allocation Agent.
    Finds conflict-free path from train's current track to target platform track,
    locks junctions, reserves tracks, and records the action.
    """
    result = route_agent.run(request.train_number, request.target_platform_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/api/route/unlock")
async def unlock_route(request: RouteUnlockRequest):
    """
    Release route locks for a train that has arrived or been cancelled.
    Frees tracks and unlocks junctions.
    """
    result = route_agent.unlock_route(request.train_number)
    return {"status": "unlocked", "details": result}

@app.get("/")
async def root():
    return {"message": "AMARD TWIN Railway Digital Twin API", "status": "operational"}

@app.get("/trains", response_model=List[dict])
async def get_all_trains():
    with get_db() as session:
        result = session.run("""
            MATCH (tr:Train)
            RETURN tr.train_number AS number,
                   tr.name AS name,
                   tr.status AS status,
                   tr.speed AS speed,
                   tr.direction AS direction
            ORDER BY tr.train_number
        """)
        return [dict(record) for record in result]
      
@app.get("/stations/{station_id}/platforms")
async def get_station_platforms(station_id: str):
    with get_db() as session:
        result = session.run("""
            MATCH (s:Station {station_id: $station_id})-[:HAS_PLATFORM]->(p:Platform)
            OPTIONAL MATCH (tr:Train)-[:AT_PLATFORM]->(p)
            RETURN {
                platform_id: p.platform_id,
                platform_number: p.platform_number,
                name: p.name,
                status: p.status,
                length_m: p.length_m,
                occupied_by: tr.train_number,
                train_name: tr.name
            } AS platform
            ORDER BY p.platform_number
        """, station_id=station_id)
        return [record["platform"] for record in result]
      

@app.get("/trains/{train_number}/location", response_model=TrainLocation)
async def get_train_location(train_number: str):
    with get_db() as session:
        result = session.run("""
            MATCH (tr:Train {train_number: $train_number})
            OPTIONAL MATCH (tr)-[:CURRENTLY_ON]->(current:TrackSegment)
            OPTIONAL MATCH (tr)-[:MOVING_TO]->(next:TrackSegment)
            OPTIONAL MATCH (current)-[:PART_OF]->(z:Zone)
            OPTIONAL MATCH (current)<-[:ADJACENT_TO]-(s:Station)
            OPTIONAL MATCH (tr)-[:FOLLOWS_ROUTE]->(r:Route)
            WITH tr, current, next, z, s, r,
              EXISTS {
                MATCH (other:Train)-[:CURRENTLY_ON]->(current)
                WHERE other.train_number <> tr.train_number
              } AS same_track_conflict,
              EXISTS {
                MATCH (current)-[:PROTECTED_BY]->(sig:Signal)
                WHERE sig.state = 'RED'
              } AS signal_conflict,
              EXISTS {
                MATCH (current)<-[:AFFECTS]-(m:MaintenanceBlock)
                WHERE m.status = 'ACTIVE'
              } AS maintenance_conflict
            RETURN {
              train_number: tr.train_number,
              train_name: tr.name,
              status: tr.status,
              speed: tr.speed,
              direction: tr.direction,
              station: CASE WHEN s IS NOT NULL THEN s.name ELSE 'Between Stations' END,
              zone: CASE WHEN z IS NOT NULL THEN z.name ELSE 'Unknown' END,
              current_track: current.track_id,
              next_track: next.track_id,
              progress_percentage: round(tr.progress_on_track * 100, 1),
              conflict_status: CASE
                WHEN same_track_conflict OR maintenance_conflict THEN 'DANGER'
                WHEN signal_conflict OR next.status IN ['OCCUPIED', 'BLOCKED'] THEN 'WARNING'
                ELSE 'SAFE'
              END,
              conflicts: CASE
                WHEN same_track_conflict THEN ['SAME_TRACK_OCCUPANCY']
                WHEN signal_conflict THEN ['SIGNAL_VIOLATION']
                WHEN maintenance_conflict THEN ['MAINTENANCE_BLOCK']
                ELSE []
              END
            } AS location
        """, train_number=train_number)
        
        record = result.single()
        if not record:
            raise HTTPException(status_code=404, detail="Train not found")
        return record["location"]

@app.post("/trains/{train_number}/update-position")
async def update_train_position(train_number: str, update: TrainPositionUpdate):
    with get_db() as session:
        result = session.run("""
            MATCH (tr:Train {train_number: $train_number})
            OPTIONAL MATCH (tr)-[old_current:CURRENTLY_ON]->()
            OPTIONAL MATCH (tr)-[old_next:MOVING_TO]->()
            OPTIONAL MATCH (tr)-[old_zone_rel:IN_ZONE]->()
            WITH tr,
              CASE WHEN old_current IS NOT NULL THEN [old_current] ELSE [] END +
              CASE WHEN old_next IS NOT NULL THEN [old_next] ELSE [] END +
              CASE WHEN old_zone_rel IS NOT NULL THEN [old_zone_rel] ELSE [] END AS rels
            FOREACH (rel IN rels | DELETE rel)
            SET tr.progress_on_track = $progress,
                tr.speed = $speed,
                tr.current_track = $current_track,
                tr.next_track = $next_track,
                tr.last_updated = datetime()
            WITH tr
            MATCH (new_track:TrackSegment {track_id: $current_track})
            MATCH (next_track:TrackSegment {track_id: $next_track})
            MATCH (new_zone:Zone {zone_id: new_track.zone_id})
            CREATE (tr)-[:CURRENTLY_ON]->(new_track)
            CREATE (tr)-[:MOVING_TO]->(next_track)
            CREATE (tr)-[:IN_ZONE]->(new_zone)
            SET new_track.status = 'OCCUPIED'
            SET next_track.status = CASE 
                WHEN next_track.status = 'FREE' THEN 'RESERVED' 
                ELSE next_track.status 
            END
            RETURN tr.train_number AS updated_train,
                   new_track.track_id AS current_track,
                   next_track.track_id AS next_track
        """, 
            train_number=train_number,
            current_track=update.current_track,
            next_track=update.next_track,
            progress=update.progress,
            speed=update.speed
        )
        
        record = result.single()
        if not record:
            raise HTTPException(status_code=404, detail="Train not found")
        return {"status": "updated", "data": dict(record)}

@app.get("/conflicts", response_model=List[ConflictAlert])
async def get_all_conflicts():
    with get_db() as session:
        result = session.run("""
            CALL {
              MATCH (t1:Train)-[:CURRENTLY_ON]->(track:TrackSegment)<-[:CURRENTLY_ON]-(t2:Train)
              WHERE t1.train_number < t2.train_number
              RETURN 
                track.track_id AS location,
                'TRACK' AS location_type,
                'SAME_TRACK_OCCUPANCY' AS conflict,
                'DANGER' AS severity,
                [t1.train_number, t2.train_number] AS involved_trains,
                datetime() AS detected_at
              
              UNION
              
              MATCH (tr:Train)-[:CURRENTLY_ON|MOVING_TO]->(t:TrackSegment)-[:PROTECTED_BY]->(sig:Signal)
              WHERE sig.state = 'RED' AND tr.speed > 0
              RETURN 
                t.track_id AS location,
                'SIGNAL' AS location_type,
                'SIGNAL_VIOLATION' AS conflict,
                'DANGER' AS severity,
                [tr.train_number] AS involved_trains,
                datetime() AS detected_at
              
              UNION
              
              MATCH (tr:Train)-[:CURRENTLY_ON]->(t:TrackSegment)<-[:AFFECTS]-(m:MaintenanceBlock)
              WHERE m.status = 'ACTIVE'
              RETURN 
                t.track_id AS location,
                'MAINTENANCE' AS location_type,
                'MAINTENANCE_VIOLATION' AS conflict,
                'DANGER' AS severity,
                [tr.train_number] AS involved_trains,
                datetime() AS detected_at
              
              UNION
              
              MATCH (tr:Train)-[:CURRENTLY_ON]->(t:TrackSegment)<-[:CONNECTS]-(j:Junction)
              WITH j, count(tr) AS train_count
              WHERE train_count > 1
              RETURN 
                j.junction_id AS location,
                'JUNCTION' AS location_type,
                'JUNCTION_CONFLICT' AS conflict,
                'DANGER' AS severity,
                [] AS involved_trains,
                datetime() AS detected_at
            }
            RETURN * ORDER BY 
              CASE severity 
                WHEN 'DANGER' THEN 1 
                WHEN 'WARNING' THEN 2 
                ELSE 3 
              END
        """)
        return [dict(record) for record in result]
      

@app.get("/zones")
async def get_zone_status():
    with get_db() as session:
        result = session.run("""
            MATCH (z:Zone)<-[:PART_OF]-(t:TrackSegment)
            OPTIONAL MATCH (tr:Train)-[:CURRENTLY_ON]->(t)
            
            WITH z, 
              count(DISTINCT tr) AS train_count,
              count(DISTINCT t) AS total_tracks,
              collect(DISTINCT tr.train_number) AS train_numbers,
              avg(CASE WHEN tr IS NOT NULL THEN tr.speed ELSE 0 END) AS avg_speed
            
            RETURN {
              zone_id: z.zone_id,
              zone_name: z.name,
              train_count: train_count,
              total_tracks: total_tracks,
              occupancy_ratio: round(toFloat(train_count) / toFloat(total_tracks) * 100, 1),
              congestion_level: z.congestion_level,
              risk_score: z.risk_score,
              avg_speed: round(avg_speed, 1),
              active_trains: train_numbers
            } AS zone_status
            ORDER BY z.risk_score DESC
        """)
        return [record["zone_status"] for record in result]

@app.get("/routes/{start_station}/{end_station}")
async def find_routes(start_station: str, end_station: str, avoid_blocked: bool = True):
    with get_db() as session:
        if avoid_blocked:
            result = session.run("""
                MATCH (start:Station {station_id: $start}), (end:Station {station_id: $end})
                MATCH path = (start)-[:ADJACENT_TO|CONNECTED_TO*1..10]-(end)
                WITH path,
                  [n IN nodes(path) WHERE n:TrackSegment] AS tracks,
                  [n IN nodes(path) WHERE n:Station] AS stations
                WHERE size(tracks) > 0
                  AND ALL(t IN tracks WHERE t.status IN ['FREE', 'RESERVED'])
                WITH path, tracks, stations,
                  reduce(total = 0.0, t IN tracks | total + t.length_km) AS total_distance,
                  [t IN tracks | t.track_id] AS track_ids
                RETURN {
                  start: head(stations).name,
                  end: last(stations).name,
                  distance_km: round(total_distance, 2),
                  tracks: track_ids,
                  safety_rating: 'SAFE'
                } AS route
                ORDER BY total_distance ASC
                LIMIT 5
            """, start=start_station, end=end_station)
        else:
            result = session.run("""
                MATCH (start:Station {station_id: $start}), (end:Station {station_id: $end})
                MATCH path = shortestPath((start)-[:ADJACENT_TO|CONNECTED_TO*]-(end))
                WITH path,
                  [n IN nodes(path) WHERE n:TrackSegment] AS tracks,
                  [n IN nodes(path) WHERE n:Station] AS stations
                WITH path, tracks, stations,
                  reduce(total = 0.0, t IN tracks | total + t.length_km) AS total_distance,
                  [t IN tracks | t.track_id] AS track_ids
                RETURN {
                  start: head(stations).name,
                  end: last(stations).name,
                  distance_km: round(total_distance, 2),
                  tracks: track_ids,
                  safety_rating: 'SHORTEST'
                } AS route
            """, start=start_station, end=end_station)
        
        return [record["route"] for record in result]

@app.get("/tracks/{track_id}/occupancy")
async def get_track_occupancy(track_id: str):
    with get_db() as session:
        result = session.run("""
            MATCH (t:TrackSegment {track_id: $track_id})
            OPTIONAL MATCH (tr:Train)-[:CURRENTLY_ON]->(t)
            
            WITH t, tr,
              CASE WHEN tr IS NOT NULL 
                THEN (tr.train_length_m / 1000.0) / t.length_km 
                ELSE 0 
              END AS coverage_ratio
            
            RETURN {
              track_id: t.track_id,
              length_km: t.length_km,
              status: t.status,
              speed_limit: t.speed_limit,
              risk_level: t.risk_level,
              occupying_train: tr.train_number,
              train_speed: tr.speed,
              occupied_percentage: round(coverage_ratio * 100, 1),
              free_percentage: round((1 - coverage_ratio) * 100, 1),
              head_position_pct: CASE WHEN tr IS NOT NULL 
                THEN round(tr.progress_on_track * 100, 1) 
                ELSE 0 END
            } AS occupancy
        """, track_id=track_id)
        
        record = result.single()
        if not record:
            raise HTTPException(status_code=404, detail="Track not found")
        return record["occupancy"]

@app.post("/maintenance/refresh")
async def refresh_zone_metrics(background_tasks: BackgroundTasks):
    def update_zones():
        with get_db() as session:
            session.run("""
                MATCH (z:Zone)
                OPTIONAL MATCH (z)<-[:PART_OF]-(t:TrackSegment)
                OPTIONAL MATCH (tr:Train)-[:CURRENTLY_ON]->(t)
                WITH z, 
                  count(DISTINCT tr) AS train_count,
                  count(DISTINCT t) AS total_tracks
                SET z.occupancy_level = train_count,
                    z.congestion_level = CASE 
                      WHEN train_count = 0 THEN 'LOW'
                      WHEN train_count <= 2 THEN 'MEDIUM'
                      WHEN train_count <= 4 THEN 'HIGH'
                      ELSE 'CRITICAL'
                    END,
                    z.risk_score = CASE 
                      WHEN train_count = 0 THEN 0.0
                      WHEN train_count <= 2 THEN 0.3
                      WHEN train_count <= 4 THEN 0.6
                      ELSE 0.9
                    END
                RETURN z.zone_id AS zone
            """)
    
    background_tasks.add_task(update_zones)
    return {"status": "Zone metrics refresh queued"}

@app.on_event("shutdown")
async def shutdown():
    driver.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)