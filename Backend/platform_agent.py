from typing import TypedDict, List, Dict, Any, Optional
from neo4j import Driver
from datetime import datetime
from langgraph.graph import StateGraph, END

# ═══════════════════════════════════════════════════════════════
# STATE DEFINITION (LangGraph)
# ═══════════════════════════════════════════════════════════════

class AgentState(TypedDict):
    train_number: str
    train_data: Dict[str, Any]
    platforms: List[Dict[str, Any]]
    events: List[Dict[str, Any]]
    conflicts: List[Dict[str, Any]]
    scored_platforms: List[Dict[str, Any]]
    decision: Dict[str, Any]
    error: Optional[str]

# ═══════════════════════════════════════════════════════════════
# NEO4J TOOLS (LangChain-style tool layer)
# ═══════════════════════════════════════════════════════════════

class Neo4jTools:
    def __init__(self, driver: Driver):
        self.driver = driver

    def get_train_info(self, train_number: str) -> Dict[str, Any]:
        query = """
        MATCH (tr:Train {train_number: $train_number})-[:FOLLOWS_ROUTE]->(r:Route)
        OPTIONAL MATCH (tr)-[:CURRENTLY_ON]->(t:TrackSegment)
        OPTIONAL MATCH (tr)-[:AT_PLATFORM]->(p:Platform)
        OPTIONAL MATCH (e:Event)-[:INVOLVES]->(tr)
        WHERE e.event_type CONTAINS 'DELAY' AND (e.resolved = false OR e.resolved IS NULL)
        RETURN tr.train_number as train_number,
               tr.name as name,
               tr.status as status,
               tr.speed as speed,
               tr.direction as direction,
               tr.train_length_m as train_length_m,
               tr.current_track as current_track,
               tr.current_platform as current_platform,
               r.route_id as route_id,
               r.name as route_name,
               r.type as route_type,
               r.priority as route_priority,
               t.track_id as current_track_id,
               collect(DISTINCT e.delay_minutes)[0] as delay_minutes
        """
        with self.driver.session() as session:
            result = session.run(query, train_number=train_number)
            record = result.single()
            return dict(record) if record else {}

    def get_available_platforms(self, train_number: str) -> List[Dict[str, Any]]:
        query = """
        MATCH (tr:Train {train_number: $train_number})-[:CURRENTLY_ON]->(ct:TrackSegment)
        MATCH (s:Station)-[:ADJACENT_TO]->(ct)
        MATCH (s)-[:HAS_PLATFORM]->(p:Platform)
        WHERE p.length_m >= tr.train_length_m
        OPTIONAL MATCH (p)-[:CONNECTED_TO]->(track:TrackSegment)
        OPTIONAL MATCH (track)-[:PROTECTED_BY]->(sig:Signal)
        OPTIONAL MATCH (track)-[:PART_OF]->(z:Zone)
        OPTIONAL MATCH (j:Junction)-[:CONNECTS]->(track)
        OPTIONAL MATCH (m:MaintenanceBlock)-[:AFFECTS]->(track)
        OPTIONAL MATCH (other:Train)-[:AT_PLATFORM]->(p)
        WHERE other.train_number <> tr.train_number
        RETURN p.platform_id as platform_id,
               p.platform_number as platform_number,
               p.name as name,
               p.status as status,
               p.length_m as length_m,
               track.track_id as track_id,
               track.status as track_status,
               track.speed_limit as speed_limit,
               sig.state as signal_state,
               z.congestion_level as congestion_level,
               z.risk_score as risk_score,
               j.conflict_risk_score as junction_risk,
               m.status as maintenance_status,
               other.train_number as occupied_by
        """
        with self.driver.session() as session:
            result = session.run(query, train_number=train_number)
            return [dict(record) for record in result]

    def get_active_events(self, train_number: str) -> List[Dict[str, Any]]:
        query = """
        MATCH (e:Event)-[:INVOLVES]->(tr:Train {train_number: $train_number})
        WHERE e.resolved = false OR e.resolved IS NULL
        RETURN e.event_id as event_id,
               e.event_type as event_type,
               e.severity as severity,
               e.delay_minutes as delay_minutes,
               e.location as location
        """
        with self.driver.session() as session:
            result = session.run(query, train_number=train_number)
            return [dict(record) for record in result]

# ═══════════════════════════════════════════════════════════════
# SCORING ENGINE
# ═══════════════════════════════════════════════════════════════

class PlatformScoringEngine:
    @staticmethod
    def score(platform: Dict[str, Any], train: Dict[str, Any]) -> Dict[str, Any]:
        score = 0
        reasons = []
        warnings = []

        # HARD FILTERS — return 0 if violated
        if platform.get('status') in ['OCCUPIED', 'MAINTENANCE', 'BLOCKED', 'INACTIVE']:
            return {"score": 0, "confidence": 0.0, "reasons": ["Platform is unavailable"], "warnings": ["REJECTED"], "valid": False}

        if platform.get('occupied_by'):
            return {"score": 0, "confidence": 0.0, "reasons": [f"Platform occupied by train {platform['occupied_by']}"], "warnings": ["REJECTED"], "valid": False}

        if platform.get('maintenance_status') == 'ACTIVE':
            return {"score": 0, "confidence": 0.0, "reasons": ["Platform under active maintenance block"], "warnings": ["REJECTED"], "valid": False}

        if platform.get('track_status') in ['BLOCKED', 'MAINTENANCE']:
            return {"score": 0, "confidence": 0.0, "reasons": ["Connected track is blocked or under maintenance"], "warnings": ["REJECTED"], "valid": False}

        # 1. Platform Availability (40)
        if platform.get('status') == 'FREE' and not platform.get('occupied_by'):
            score += 40
            reasons.append("Platform is free and available")
        elif platform.get('status') == 'RESERVED':
            score += 25
            reasons.append("Platform is reserved but unoccupied")
            warnings.append("Platform is reserved")
        else:
            reasons.append(f"Platform status is {platform.get('status', 'UNKNOWN')}")

        # 2. Track Health (20)
        track_status = platform.get('track_status', 'UNKNOWN')
        if track_status == 'FREE':
            score += 20
            reasons.append("Connected track is free and healthy")
        elif track_status == 'RESERVED':
            score += 15
            reasons.append("Connected track is reserved")
            warnings.append("Track is reserved")
        elif track_status == 'OCCUPIED':
            score += 5
            reasons.append("Connected track is occupied")
            warnings.append("Track occupied")
        else:
            reasons.append(f"Connected track status: {track_status}")

        # 3. Congestion (10)
        congestion = platform.get('congestion_level', 'LOW')
        if congestion == 'LOW':
            score += 10
            reasons.append("Zone congestion is low")
        elif congestion == 'MEDIUM':
            score += 7
            reasons.append("Zone congestion is moderate")
        elif congestion == 'HIGH':
            score += 3
            reasons.append("Zone congestion is high")
            warnings.append("High congestion zone")
        else:
            reasons.append("Zone congestion is critical")
            warnings.append("CRITICAL congestion")

        # 4. Signal State (10)
        signal = platform.get('signal_state', 'RED')
        if signal == 'GREEN':
            score += 10
            reasons.append("Approach signal is GREEN")
        elif signal == 'YELLOW':
            score += 5
            reasons.append("Approach signal is YELLOW")
            warnings.append("Caution: Yellow signal")
        else:
            reasons.append("Approach signal is RED")
            warnings.append("Signal is RED")

        # 5. Route Priority (10)
        route_type = train.get('route_type', 'PASSENGER')
        priority = train.get('route_priority', 2)
        if priority == 1 or route_type in ['EXPRESS', 'INTERCITY']:
            score += 10
            reasons.append("Express/Intercity priority route")
        elif priority == 2 or route_type == 'PASSENGER':
            score += 7
            reasons.append("Passenger priority route")
        else:
            score += 5
            reasons.append("Freight priority route")

        # 6. Junction Risk (5)
        j_risk = platform.get('junction_risk') or 0.0
        if j_risk < 0.3:
            score += 5
            reasons.append("Junction risk is low")
        elif j_risk < 0.6:
            score += 3
            reasons.append("Junction risk is moderate")
            warnings.append("Moderate junction risk")
        else:
            reasons.append("Junction risk is high")
            warnings.append("High junction risk")

        # 7. Delay Recovery (5)
        delay = train.get('delay_minutes') or 0
        speed_limit = platform.get('speed_limit') or 0
        if delay > 0:
            if speed_limit >= 100:
                score += 5
                reasons.append("Fast track available for delayed train recovery")
            elif speed_limit >= 60:
                score += 3
                reasons.append("Moderate-speed track for delay recovery")
            else:
                reasons.append("Slow track - limited delay recovery")
                warnings.append("Slow track for delayed train")
        else:
            score += 5
            reasons.append("Train is on schedule")

        confidence = round(score / 100.0, 2)
        return {"score": score, "confidence": confidence, "reasons": reasons, "warnings": warnings, "valid": True}

# ═══════════════════════════════════════════════════════════════
# LANGGRAPH NODES
# ═══════════════════════════════════════════════════════════════

class PlatformAllocationAgent:
    def __init__(self, driver: Driver):
        self.driver = driver
        self.tools = Neo4jTools(driver)
        self.scoring = PlatformScoringEngine()
        self.graph = self._build_graph()

    def _build_graph(self):
        # Node 1: Load Train
        def load_train(state: AgentState):
            try:
                data = self.tools.get_train_info(state['train_number'])
                if not data:
                    state['error'] = f"Train {state['train_number']} not found"
                else:
                    state['train_data'] = data
            except Exception as e:
                state['error'] = str(e)
            return state

        # Node 2: Load Platforms
        def load_platforms(state: AgentState):
            if state.get('error'):
                return state
            try:
                platforms = self.tools.get_available_platforms(state['train_number'])
                state['platforms'] = platforms
                if not platforms:
                    state['error'] = "No suitable platforms found (check train length vs platform capacity)"
            except Exception as e:
                state['error'] = str(e)
            return state

        # Node 3: Load Events
        def load_events(state: AgentState):
            if state.get('error'):
                return state
            try:
                state['events'] = self.tools.get_active_events(state['train_number'])
            except Exception as e:
                state['error'] = str(e)
            return state

        # Node 4: Detect Conflicts
        def detect_conflicts(state: AgentState):
            if state.get('error'):
                return state
            conflicts = []
            for p in state.get('platforms', []):
                if p.get('occupied_by') and p['occupied_by'] != state['train_number']:
                    conflicts.append({
                        "type": "PLATFORM_OCCUPIED",
                        "platform_id": p['platform_id'],
                        "occupying_train": p['occupied_by'],
                        "severity": "DANGER"
                    })
                if p.get('track_status') == 'OCCUPIED':
                    conflicts.append({
                        "type": "TRACK_OCCUPIED",
                        "track_id": p.get('track_id'),
                        "platform_id": p['platform_id'],
                        "severity": "WARNING"
                    })
            state['conflicts'] = conflicts
            return state

        # Node 5: Score Platforms
        def score_platforms(state: AgentState):
            if state.get('error'):
                return state
            scored = []
            train = state['train_data']
            for platform in state.get('platforms', []):
                result = self.scoring.score(platform, train)
                scored.append({**platform, **result})
            scored.sort(key=lambda x: x['score'], reverse=True)
            state['scored_platforms'] = scored
            return state

        # Node 6: Make Decision
        def make_decision(state: AgentState):
            if state.get('error'):
                return state
            valid = [p for p in state.get('scored_platforms', []) if p.get('valid', False)]
            if not valid:
                state['error'] = "No valid platforms after scoring and conflict detection"
                return state

            winner = valid[0]
            alternatives = valid[1:3]

            state['decision'] = {
                "train_number": state['train_number'],
                "recommended_platform": winner['platform_id'],
                "recommended_platform_name": winner.get('name'),
                "confidence": winner['confidence'],
                "score": winner['score'],
                "reasoning": winner['reasons'],
                "warnings": winner.get('warnings', []),
                "alternative_platforms": [
                    {
                        "platform": alt['platform_id'],
                        "platform_name": alt.get('name'),
                        "score": alt['score'],
                        "confidence": alt['confidence']
                    }
                    for alt in alternatives
                ]
            }
            return state

        # Node 7: Update Neo4j
        def update_neo4j(state: AgentState):
            if state.get('error') or not state.get('decision'):
                return state
            platform_id = state['decision']['recommended_platform']
            train_number = state['train_number']
            query = """
            MATCH (tr:Train {train_number: $train_number})
            MATCH (p:Platform {platform_id: $platform_id})
            OPTIONAL MATCH (tr)-[old:AT_PLATFORM]->()
            DELETE old
            CREATE (tr)-[:AT_PLATFORM]->(p)
            SET p.status = 'RESERVED',
                tr.current_platform = p.platform_id
            RETURN p.platform_id as platform_id, p.name as platform_name
            """
            try:
                with self.driver.session() as session:
                    result = session.run(query, train_number=train_number, platform_id=platform_id)
                    record = result.single()
                    if record:
                        state['decision']['allocated'] = True
                        state['decision']['allocated_at'] = datetime.now().isoformat()
            except Exception as e:
                state['error'] = f"Neo4j update failed: {str(e)}"
            return state

        # Router
        def route(state: AgentState):
            return "end" if state.get("error") else "continue"

        # Build graph
        workflow = StateGraph(AgentState)
        workflow.add_node("load_train", load_train)
        workflow.add_node("load_platforms", load_platforms)
        workflow.add_node("load_events", load_events)
        workflow.add_node("detect_conflicts", detect_conflicts)
        workflow.add_node("score_platforms", score_platforms)
        workflow.add_node("make_decision", make_decision)
        workflow.add_node("update_neo4j", update_neo4j)

        workflow.set_entry_point("load_train")
        workflow.add_conditional_edges("load_train", route, {"end": END, "continue": "load_platforms"})
        workflow.add_conditional_edges("load_platforms", route, {"end": END, "continue": "load_events"})
        workflow.add_edge("load_events", "detect_conflicts")
        workflow.add_edge("detect_conflicts", "score_platforms")
        workflow.add_edge("score_platforms", "make_decision")
        workflow.add_conditional_edges("make_decision", route, {"end": END, "continue": "update_neo4j"})
        workflow.add_edge("update_neo4j", END)

        return workflow.compile()

    def run(self, train_number: str) -> Dict[str, Any]:
        initial_state: AgentState = {
            "train_number": train_number,
            "train_data": {},
            "platforms": [],
            "events": [],
            "conflicts": [],
            "scored_platforms": [],
            "decision": {},
            "error": None
        }
        result = self.graph.invoke(initial_state)
        if result.get("error"):
            return {
                "error": result["error"],
                "train_number": train_number,
                "scored_platforms": result.get("scored_platforms", [])
            }
        return result["decision"]

    def reallocate(self, train_number: str, force_platform_id: Optional[str] = None) -> Dict[str, Any]:
        # Release current allocation
        release_query = """
        MATCH (tr:Train {train_number: $train_number})-[r:AT_PLATFORM]->(p:Platform)
        DELETE r
        SET p.status = 'FREE',
            tr.current_platform = null
        """
        with self.driver.session() as session:
            session.run(release_query, train_number=train_number)

        if force_platform_id:
            alloc_query = """
            MATCH (tr:Train {train_number: $train_number})
            MATCH (p:Platform {platform_id: $platform_id})
            CREATE (tr)-[:AT_PLATFORM]->(p)
            SET p.status = 'OCCUPIED',
                tr.current_platform = p.platform_id
            RETURN p.platform_id as platform_id
            """
            with self.driver.session() as session:
                session.run(alloc_query, train_number=train_number, platform_id=force_platform_id)
            return {
                "train_number": train_number,
                "recommended_platform": force_platform_id,
                "confidence": 1.0,
                "score": 100,
                "reasoning": ["Forced reallocation by operator"],
                "alternative_platforms": [],
                "forced": True
            }

        return self.run(train_number)