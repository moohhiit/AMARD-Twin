from typing import TypedDict, List, Dict, Any, Optional
from neo4j import Driver
from datetime import datetime
from langgraph.graph import StateGraph, END


class RouteAgentState(TypedDict):
    train_number: str
    target_platform_id: str
    train_data: Dict[str, Any]
    route_path: Dict[str, Any]
    conflicts: List[Dict[str, Any]]
    decision: Dict[str, Any]
    error: Optional[str]


class RouteAllocationAgent:
    def __init__(self, driver: Driver):
        self.driver = driver
        self.graph = self._build_graph()

    def _build_graph(self):
        def load_context(state: RouteAgentState):
            train_number = state['train_number']
            platform_id = state['target_platform_id']

            # Step 1: Verify train exists
            with self.driver.session() as session:
                train_check = session.run(
                    "MATCH (tr:Train {train_number: $n}) RETURN tr.current_track AS ct",
                    n=train_number
                ).single()
                if not train_check:
                    state['error'] = f"Train '{train_number}' not found in database"
                    return state
                if train_check['ct'] is None:
                    state['error'] = f"Train '{train_number}' exists but has no current_track assigned"
                    return state

            # Step 2: Verify platform exists
            with self.driver.session() as session:
                plat_check = session.run(
                    "MATCH (p:Platform {platform_id: $pid}) RETURN p.name AS name",
                    pid=platform_id
                ).single()
                if not plat_check:
                    state['error'] = f"Platform '{platform_id}' not found in database"
                    return state

            # Step 3: Verify platform has required relationships
            with self.driver.session() as session:
                rel_check = session.run("""
                    MATCH (p:Platform {platform_id: $pid})-[:CONNECTED_TO]->(end:TrackSegment)
                    MATCH (s:Station)-[:HAS_PLATFORM]->(p)
                    RETURN end.track_id AS end_track, s.name AS station_name
                """, pid=platform_id).single()
                if not rel_check:
                    state['error'] = f"Platform '{platform_id}' exists but missing CONNECTED_TO track or HAS_PLATFORM station relationship"
                    return state

            # Step 4: Load full context
            query = """
            MATCH (tr:Train {train_number: $train_number})
            MATCH (target:Platform {platform_id: $platform_id})-[:CONNECTED_TO]->(end:TrackSegment)
            MATCH (s:Station)-[:HAS_PLATFORM]->(target)
            RETURN tr.train_number as train_number,
                   tr.name as train_name,
                   tr.status as status,
                   tr.speed as speed,
                   tr.direction as direction,
                   tr.current_track as current_track,
                   tr.train_length_m as train_length_m,
                   target.platform_id as target_platform,
                   target.name as target_platform_name,
                   target.status as platform_status,
                   target.length_m as platform_length,
                   end.track_id as end_track,
                   s.name as station_name
            """
            try:
                with self.driver.session() as session:
                    result = session.run(query, train_number=train_number, platform_id=platform_id)
                    record = result.single()
                    if not record:
                        state['error'] = "Failed to load context after verification"
                        return state
                    state['train_data'] = dict(record)
            except Exception as e:
                state['error'] = str(e)
            return state

        def find_and_evaluate_path(state: RouteAgentState):
            if state.get('error'):
                return state

            start_track = state['train_data']['current_track']
            end_track = state['train_data']['end_track']

            # If already on target track, instant success
            if start_track == end_track:
                state['route_path'] = {
                    "tracks": [],
                    "junctions": [],
                    "total_hops": 0,
                    "start_track": start_track,
                    "end_track": end_track
                }
                state['conflicts'] = []
                return state

            query = """
            MATCH (start:TrackSegment {track_id: $start_track})
            MATCH (end:TrackSegment {track_id: $end_track})
            OPTIONAL MATCH path = shortestPath((start)-[:CONNECTED_TO*1..25]-(end))
            WITH start, end, path,
                 CASE WHEN path IS NULL THEN [] ELSE [n IN nodes(path) WHERE n:TrackSegment] END AS tracks,
                 CASE WHEN path IS NULL THEN [] ELSE [n IN nodes(path) WHERE n:Junction] END AS junctions,
                 CASE WHEN path IS NULL THEN -1 ELSE length(path) END AS hops
            WHERE hops >= 0
            UNWIND tracks AS t
            OPTIONAL MATCH (t)-[:PROTECTED_BY]->(sig:Signal)
            OPTIONAL MATCH (m:MaintenanceBlock)-[:AFFECTS]->(t)
            OPTIONAL MATCH (occupant:Train)-[:CURRENTLY_ON]->(t)
            WHERE occupant.train_number <> $train_number
            WITH tracks, junctions, hops, t, sig, m, occupant,
                 (t.status IN ['FREE', 'RESERVED'] OR t.track_id = $start_track) AS track_ok,
                 (m IS NULL OR m.status <> 'ACTIVE') AS maint_ok,
                 (occupant IS NULL) AS occupant_ok,
                 (sig IS NULL OR sig.state <> 'RED') AS signal_ok,
                 t.track_id AS track_id,
                 t.length_km AS length_km,
                 t.status AS track_status,
                 t.speed_limit AS speed_limit,
                 sig.signal_id AS signal_id,
                 sig.state AS signal_state
            WITH tracks, junctions, hops,
                 collect(DISTINCT {
                     track_id: track_id,
                     length_km: length_km,
                     status: track_status,
                     speed_limit: speed_limit,
                     signal_id: signal_id,
                     signal_state: signal_state,
                     track_ok: track_ok,
                     maint_ok: maint_ok,
                     occupant_ok: occupant_ok,
                     signal_ok: signal_ok
                 }) AS track_details,
                 head([n IN tracks | n.track_id]) AS start_track,
                 last([n IN tracks | n.track_id]) AS end_track
            UNWIND junctions AS j
            WITH tracks, track_details, hops, start_track, end_track, j
            RETURN track_details,
                   collect(DISTINCT {junction_id: j.junction_id, name: j.name, status: j.status}) AS junction_details,
                   hops AS total_hops,
                   start_track,
                   end_track
            """
            try:
                with self.driver.session() as session:
                    result = session.run(query,
                        train_number=state['train_number'],
                        start_track=start_track,
                        end_track=end_track
                    )
                    record = result.single()
                    if not record:
                        state['error'] = f"No path found from track '{start_track}' to platform track '{end_track}'. Check if tracks are connected via CONNECTED_TO relationships."
                        return state

                    data = dict(record)
                    tracks = data.get('track_details', []) or []
                    junctions = data.get('junction_details', []) or []

                    conflicts = []
                    for t in tracks:
                        if not t.get('track_ok'):
                            conflicts.append({
                                "type": "TRACK_BLOCKED",
                                "track_id": t['track_id'],
                                "severity": "DANGER",
                                "reason": f"Track {t['track_id']} is {t.get('status', 'UNKNOWN')}"
                            })
                        if not t.get('maint_ok'):
                            conflicts.append({
                                "type": "MAINTENANCE_BLOCK",
                                "track_id": t['track_id'],
                                "severity": "DANGER",
                                "reason": "Active maintenance block on track"
                            })
                        if not t.get('occupant_ok'):
                            conflicts.append({
                                "type": "TRACK_OCCUPIED",
                                "track_id": t['track_id'],
                                "severity": "DANGER",
                                "reason": "Another train occupies this track"
                            })
                        if not t.get('signal_ok'):
                            conflicts.append({
                                "type": "SIGNAL_RED",
                                "track_id": t['track_id'],
                                "signal_id": t.get('signal_id'),
                                "severity": "WARNING",
                                "reason": f"Signal {t.get('signal_id', 'UNKNOWN')} is RED"
                            })

                    for j in junctions:
                        if j.get('status') == 'LOCKED':
                            conflicts.append({
                                "type": "JUNCTION_LOCKED",
                                "junction_id": j.get('junction_id'),
                                "severity": "WARNING",
                                "reason": f"Junction {j.get('junction_id', 'UNKNOWN')} is locked by another route"
                            })

                    state['route_path'] = {
                        "tracks": tracks,
                        "junctions": junctions,
                        "total_hops": data.get('total_hops', 0),
                        "start_track": data.get('start_track'),
                        "end_track": data.get('end_track')
                    }
                    state['conflicts'] = conflicts

                    if any(c['severity'] == 'DANGER' for c in conflicts):
                        state['error'] = f"Route blocked by {len([c for c in conflicts if c['severity']=='DANGER'])} critical conflict(s)"
                        return state

            except Exception as e:
                state['error'] = str(e)
            return state

        def make_decision(state: RouteAgentState):
            if state.get('error'):
                return state

            path = state['route_path']
            tracks = path.get('tracks', [])
            junctions = path.get('junctions', [])

            total_distance = sum(t.get('length_km', 0) for t in tracks)
            speeds = [t.get('speed_limit') for t in tracks if t.get('speed_limit')]
            min_speed = min(speeds) if speeds else 0
            estimated_time = round((total_distance / max(min_speed, 1)) * 60, 1) if min_speed > 0 else 0

            switches = []
            for j in junctions:
                switches.append({
                    "junction_id": j.get('junction_id'),
                    "junction_name": j.get('name'),
                    "current_status": j.get('status'),
                    "required_action": "LOCK_FOR_ROUTE"
                })

            warnings = [c['reason'] for c in state['conflicts'] if c['severity'] == 'WARNING']
            cautions = [c['reason'] for c in state['conflicts'] if c['severity'] == 'CAUTION']

            state['decision'] = {
                "train_number": state['train_number'],
                "target_platform": state['target_platform_id'],
                "target_platform_name": state['train_data']['target_platform_name'],
                "station_name": state['train_data']['station_name'],
                "route_confirmed": True,
                "total_tracks": len(tracks),
                "total_distance_km": round(total_distance, 2),
                "min_speed_limit_kmh": min_speed,
                "estimated_time_min": estimated_time,
                "tracks_traversed": [t['track_id'] for t in tracks],
                "switches_to_set": switches,
                "warnings": warnings,
                "cautions": cautions,
                "reasoning": [
                    f"Shortest path found via {len(tracks)} track segment(s)",
                    f"Total distance: {round(total_distance, 2)} km",
                    f"Minimum speed limit: {min_speed} km/h",
                    f"Estimated traverse time: {estimated_time} min",
                    f"Junctions to lock: {len(junctions)}"
                ]
            }
            return state

        def lock_route(state: RouteAgentState):
            if state.get('error') or not state.get('decision'):
                return state

            tracks = state['route_path'].get('tracks', [])
            junctions = state['route_path'].get('junctions', [])
            train_number = state['train_number']

            track_ids = [t['track_id'] for t in tracks]

            try:
                with self.driver.session() as session:
                    if track_ids:
                        session.run("""
                            UNWIND $track_ids AS tid
                            MATCH (t:TrackSegment {track_id: tid})
                            SET t.status = CASE WHEN t.status = 'FREE' THEN 'RESERVED' ELSE t.status END
                        """, track_ids=track_ids)

                    junction_ids = [j['junction_id'] for j in junctions if j.get('junction_id')]
                    if junction_ids:
                        session.run("""
                            UNWIND $junction_ids AS jid
                            MATCH (j:Junction {junction_id: jid})
                            SET j.status = 'LOCKED'
                        """, junction_ids=junction_ids)

                    result = session.run("""
                        CREATE (act:Action {
                            action_id: 'ACT_ROUTE_' + $train_number + '_' + toString(timestamp()),
                            type: 'ROUTE_LOCK',
                            status: 'ACTIVE',
                            timestamp: datetime(),
                            train_number: $train_number,
                            target_platform: $target_platform,
                            tracks: $track_ids,
                            junctions: $junction_ids,
                            reasoning: $reasoning
                        })
                        WITH act
                        MATCH (tr:Train {train_number: $train_number})
                        CREATE (act)-[:TARGETS]->(tr)
                        RETURN act.action_id AS action_id
                    """,
                        train_number=train_number,
                        target_platform=state['target_platform_id'],
                        track_ids=track_ids,
                        junction_ids=junction_ids,
                        reasoning="; ".join(state['decision']['reasoning'])
                    )
                    record = result.single()
                    if record:
                        state['decision']['action_id'] = record['action_id']
                        state['decision']['locked_at'] = datetime.now().isoformat()
            except Exception as e:
                state['error'] = f"Failed to lock route: {str(e)}"

            return state

        def route(state: RouteAgentState):
            return "end" if state.get("error") else "continue"

        workflow = StateGraph(RouteAgentState)
        workflow.add_node("load_context", load_context)
        workflow.add_node("find_and_evaluate_path", find_and_evaluate_path)
        workflow.add_node("make_decision", make_decision)
        workflow.add_node("lock_route", lock_route)

        workflow.set_entry_point("load_context")
        workflow.add_conditional_edges("load_context", route, {"end": END, "continue": "find_and_evaluate_path"})
        workflow.add_conditional_edges("find_and_evaluate_path", route, {"end": END, "continue": "make_decision"})
        workflow.add_edge("make_decision", "lock_route")
        workflow.add_edge("lock_route", END)

        return workflow.compile()

    def run(self, train_number: str, target_platform_id: str) -> Dict[str, Any]:
        initial_state: RouteAgentState = {
            "train_number": train_number,
            "target_platform_id": target_platform_id,
            "train_data": {},
            "route_path": {},
            "conflicts": [],
            "decision": {},
            "error": None
        }
        result = self.graph.invoke(initial_state)
        if result.get("error"):
            return {
                "error": result["error"],
                "train_number": train_number,
                "target_platform": target_platform_id,
                "conflicts": result.get("conflicts", [])
            }
        return result["decision"]

    def unlock_route(self, train_number: str):
        query = """
        MATCH (tr:Train {train_number: $train_number})
        OPTIONAL MATCH (tr)-[:CURRENTLY_ON]->(t:TrackSegment)
        OPTIONAL MATCH (tr)-[:MOVING_TO]->(next:TrackSegment)
        WITH tr, collect(DISTINCT t) + collect(DISTINCT next) AS related_tracks
        UNWIND related_tracks AS t
        WITH DISTINCT t
        SET t.status = CASE WHEN t.status = 'RESERVED' THEN 'FREE' ELSE t.status END
        WITH t
        MATCH (j:Junction)-[:CONNECTS]->(t)
        SET j.status = 'ACTIVE'
        RETURN count(t) AS unlocked_tracks
        """
        with self.driver.session() as session:
            result = session.run(query, train_number=train_number)
            record = result.single()
            return {"unlocked_tracks": record["unlocked_tracks"] if record else 0}