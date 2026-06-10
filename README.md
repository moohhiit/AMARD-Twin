RailMind AI
AI-powered Railway Traffic Management and Digital Twin System
RailMind AI is a production-grade, event-driven multi-agent backend for real-time railway traffic simulation, control, and monitoring. It uses a Neo4j graph database to model the entire railway network as a digital twin, with specialized AI agents handling platform allocation, route planning, signal control, conflict detection, delay propagation, and emergency response.
Architecture
plain
┌─────────────────────────────────────────────────────────────┐
│                        FastAPI Layer                         │
│  REST API  +  WebSocket (/ws/live)  +  Health/Metrics       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  RoutingService  |  PredictionService  |  DispatchService    │
│  MonitoringService                                           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Agent Layer (10 Agents)                │
│  Platform  Route  Signal  LoopLine  Delay  Conflict        │
│  Dispatch  Maintenance  Emergency  NetworkMonitoring         │
│                                                              │
│  RULE: Agents NEVER call each other directly.              │
│  RULE: Agents communicate ONLY through the Event Bus.      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Event Bus (Async)                       │
│  Publish  |  Subscribe  |  Queue-based Processing           │
│  11 Event Types: TRAIN_APPROACHING, SIGNAL_GREEN, etc.    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Neo4j Graph (Aura)                      │
│  Nodes: Train, Station, TrackSegment, Signal, Junction     │
│         Route, MaintenanceBlock, Platform, Zone, Event       │
│  Relationships: CURRENTLY_ON, CONNECTED_TO, PROTECTED_BY    │
│                 FOLLOWS_ROUTE, AFFECTS, etc.                │
└─────────────────────────────────────────────────────────────┘
Technology Stack
Table
Layer	Technology
Web Framework	FastAPI (Python 3.12+)
Graph Database	Neo4j Aura Free (Async Driver)
Architecture	Event-Driven Multi-Agent
Real-time	WebSockets with topic filtering
Validation	Pydantic v2
Logging	structlog (JSON structured)
Async	asyncio, uvicorn
Quick Start
1. Environment Setup
bash
cp .env.example .env
# Edit .env and fill in your Neo4j Aura credentials:
# NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
# NEO4J_USERNAME=neo4j
# NEO4J_PASSWORD=your-password
2. Install Dependencies
bash
pip install -r requirements.txt
3. Run the Application
bash
python -m backend.main
# Or with uvicorn directly:
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
4. Verify Health
bash
curl http://localhost:8000/health
WebSocket Live Feed
Connect to ws://localhost:8000/ws/live for real-time digital twin updates.
Browser Console Test
JavaScript
const ws = new WebSocket("ws://localhost:8000/ws/live");
ws.onopen = () => {
    ws.send(JSON.stringify({
        action: "subscribe",
        topics: ["train_positions", "signal_updates", "emergency_events"]
    }));
};
ws.onmessage = (msg) => console.log(JSON.parse(msg.data));
Available Topics
Table
Topic	Events Broadcast
train_positions	TRAIN_APPROACHING, MOVEMENT_AUTHORITY_GRANTED
route_changes	ROUTE_ASSIGNED, ROUTE_CLEAR
platform_occupancy	PLATFORM_ASSIGNED
delay_updates	TRAIN_DELAYED
signal_updates	SIGNAL_GREEN, SIGNAL_RED
emergency_events	EMERGENCY_TRIGGERED, ROUTE_CONFLICT
all	Every event type
REST API Endpoints
Health & System
Table
Method	Endpoint	Description
GET	/health	System health check. Returns Neo4j status, event bus queue size, agent states, WebSocket connection count
GET	/metrics	Digital twin aggregated metrics (train count, avg speed, signal states, congestion levels)
Trains (/api/v1/trains)
Table
Method	Endpoint	Description
POST	/api/v1/trains	Create a new train node in the graph with all properties (number, name, speed, track, length, etc.)
GET	/api/v1/trains	List all trains with their current track, zone, and route relationships
GET	/api/v1/trains/{train_number}	Get a specific train by its unique train number
PATCH	/api/v1/trains/{train_number}	Update train properties (status, speed, track, route, progress)
POST	/api/v1/trains/{train_number}/position	Update train position, speed, and track segment atomically. Rewires CURRENTLY_ON relationship
GET	/api/v1/trains/{train_number}/graph	Get train with full graph traversal: current track, next track, zone, route, platform
DELETE	/api/v1/trains/{train_number}	Delete a train and all its relationships from the graph
Routes (/api/v1/routes)
Table
Method	Endpoint	Description
POST	/api/v1/routes	Create a new route definition (route_id, name, type, priority)
GET	/api/v1/routes/{route_id}	Retrieve a route by its ID
POST	/api/v1/routes/plan	Plan shortest valid path between two track segments. Respects speed limits, maintenance blocks, and track status. Returns path + alternatives
POST	/api/v1/routes/reserve	Atomically reserve a route for a train. Creates MOVING_TO relationships. Prevents double-booking via locking pattern
POST	/api/v1/routes/{route_id}/clear	Clear a reserved route — removes all MOVING_TO relationships for the train
GET	/api/v1/routes/{route_id}/conflicts	Get conflict report: trains sharing track segments with this route
Platforms (/api/v1/platforms)
Table
Method	Endpoint	Description
POST	/api/v1/platforms	Create a new platform linked to a station via HAS_PLATFORM relationship
GET	/api/v1/platforms	List all platforms with station name, occupancy status, and connected track
GET	/api/v1/platforms?station_id=STN_001	Filter platforms by parent station
GET	/api/v1/platforms/{platform_id}	Get a specific platform by ID
POST	/api/v1/platforms/allocate	Allocate the best available platform to a train. Checks: FREE status, train length match, no active maintenance
POST	/api/v1/platforms/release	Release a platform from its current train. Sets status to FREE
Signals (/api/v1/signals)
Table
Method	Endpoint	Description
POST	/api/v1/signals	Create a new signal protecting a track segment. Creates PROTECTED_BY relationship
GET	/api/v1/signals	List all signals with counts: total, green, red, yellow
GET	/api/v1/signals/{signal_id}	Get a specific signal with its protected track and occupant train
PATCH	/api/v1/signals/{signal_id}	Update signal state (GREEN, RED, YELLOW, FLASHING)
POST	/api/v1/signals/safety-check	Comprehensive safety check before setting GREEN. Checks: track occupancy, active maintenance, downstream blocking, junction faults
Conflicts (/api/v1/conflicts)
Table
Method	Endpoint	Description
GET	/api/v1/conflicts/active	Aggregate all active conflicts: track occupancy, route overlap, junction conflicts
GET	/api/v1/conflicts/track-occupancy	Detect multiple trains occupying the same track segment
GET	/api/v1/conflicts/route-overlap	Detect trains with overlapping MOVING_TO routes
GET	/api/v1/conflicts/junction	Detect junctions with conflicting train movements
GET	/api/v1/conflicts/headway	Detect trains too close on the same track (default min 1.0 km)
GET	/api/v1/conflicts/history/{train_number}	Retrieve historical conflict events involving a specific train
Delays (/api/v1/delays)
Table
Method	Endpoint	Description
GET	/api/v1/delays/predict/{train_number}	Predict downstream delays for a train. Traverses CONNECTED_TO path, checks maintenance blocks and blocking trains
GET	/api/v1/delays/congestion	Estimate congestion levels across all zones or a specific zone
GET	/api/v1/delays/eta/{train_number}	Calculate estimated time of arrival to a destination track using shortest path
GET	/api/v1/delays/report	Comprehensive delay report: all delayed trains, total delay minutes, affected locations
POST	/api/v1/delays/hold/{train_number}	Hold/stop a train at current position. Sets speed=0, status=STOPPED, clears route
Network State (/api/v1/network-state)
Table
Method	Endpoint	Description
GET	/api/v1/network-state	Full digital twin snapshot. Returns all trains, tracks, signals, platforms, zones, and events from the graph
GET	/api/v1/network-state/trains	Current positions of all trains with track and zone resolution
GET	/api/v1/network-state/metrics	Aggregated system metrics: train counts, avg speed, signal states, platform occupancy, zone congestion
GET	/api/v1/network-state/digital-twin	Live digital twin state maintained by NetworkMonitoringAgent (event history + metrics)
GET	/api/v1/network-state/events	Recent system events from the graph, ordered by timestamp
GET	/api/v1/network-state/events/stats	Event statistics: total count, by type, by severity, unresolved count, avg delay
Multi-Agent System
Table
Agent	Responsibility	Subscribes To	Emits
PlatformAllocationAgent	Find free platforms, match train length, check maintenance restrictions	TRAIN_APPROACHING	PLATFORM_ASSIGNED
RouteAllocationAgent	Find shortest valid route via graph traversal, configure junctions, reserve path	PLATFORM_ASSIGNED, TRAIN_APPROACHING	ROUTE_ASSIGNED
SignalControlAgent	Check track occupancy/safety, control signal states, cascade RED on conflicts	ROUTE_ASSIGNED, ROUTE_CONFLICT, EMERGENCY_TRIGGERED	SIGNAL_GREEN, SIGNAL_RED
LoopLineAgent	Divert slower trains, prioritize faster trains on shared segments	ROUTE_CONFLICT, TRAIN_DELAYED	ROUTE_ASSIGNED (diversion)
DelayPropagationAgent	Predict downstream delays, estimate cascade impact using decay model	TRAIN_DELAYED	TRAIN_DELAYED (cascade)
ConflictDetectionAgent	Continuous scan for track occupancy, route overlap, junction, headway conflicts	TRAIN_APPROACHING	ROUTE_CONFLICT, EMERGENCY_TRIGGERED
TrainDispatchAgent	Priority queue for train movement, issue movement authority	SIGNAL_GREEN, ROUTE_CLEAR	MOVEMENT_AUTHORITY_GRANTED
MaintenanceAgent	Monitor maintenance blocks, generate alerts for active and upcoming blocks	— (periodic)	MAINTENANCE_REQUIRED
EmergencyResponseAgent	Handle failures, stop affected trains, block routes, cascade signals	EMERGENCY_TRIGGERED, ROUTE_CONFLICT	SIGNAL_RED, TRAIN_DELAYED
NetworkMonitoringAgent	Maintain digital twin state, aggregate metrics, feed dashboard	All 11 event types	— (WebSocket broadcast)
Graph Schema
Nodes
Train — train_number, name, status, speed, direction, current_track, next_track, route_id, progress_on_track, train_length_m, current_platform
Station — station_id, name, city, type
Zone — zone_id, name, occupancy_level, congestion_level, risk_score
TrackSegment — track_id, length_km, speed_limit, status, risk_level, zone_id
Signal — signal_id, state, controlled_track
Junction — junction_id, name, status, conflict_risk_score
Route — route_id, name, type, priority
MaintenanceBlock — block_id, reason, start_time, end_time, status
Platform — platform_id, platform_number, name, status, length_m, station_id
Event — event_id, event_type, severity, timestamp, resolved, source_train, delay_minutes, location
Relationships
(TRAIN)-[:CURRENTLY_ON]->(TRACKSEGMENT)
(TRAIN)-[:MOVING_TO]->(TRACKSEGMENT)
(TRAIN)-[:IN_ZONE]->(ZONE)
(TRAIN)-[:FOLLOWS_ROUTE]->(ROUTE)
(TRAIN)-[:AT_PLATFORM]->(PLATFORM)
(TRACKSEGMENT)-[:PART_OF]->(ZONE)
(TRACKSEGMENT)-[:CONNECTED_TO]->(TRACKSEGMENT)
(TRACKSEGMENT)-[:PROTECTED_BY]->(SIGNAL)
(JUNCTION)-[:CONNECTS]->(TRACKSEGMENT)
(MAINTENANCEBLOCK)-[:AFFECTS]->(TRACKSEGMENT)
(STATION)-[:HAS_PLATFORM]->(PLATFORM)
(STATION)-[:ADJACENT_TO]->(TRACKSEGMENT)
(PLATFORM)-[:CONNECTED_TO]->(TRACKSEGMENT)
(EVENT)-[:INVOLVES]->(TRAIN)
(EVENT)-[:AFFECTS]->(TRACKSEGMENT)
Event Types
Table
Event	Triggered By	Payload
TRAIN_APPROACHING	External simulation	train_number, station_id, distance_km
PLATFORM_ASSIGNED	PlatformAllocationAgent	train_number, platform_id, station_id
ROUTE_ASSIGNED	RouteAllocationAgent	train_number, route_id, track_sequence
ROUTE_CLEAR	RouteAllocationAgent / API	train_number, route_id, clear_reason
ROUTE_CONFLICT	ConflictDetectionAgent	conflict_type, track_id, train_a, train_b, severity
SIGNAL_GREEN	SignalControlAgent	signal_id, track_id, train_number
SIGNAL_RED	SignalControlAgent / Emergency	signal_id, track_id, reason, cascade
TRAIN_DELAYED	DelayPropagationAgent	train_number, delay_minutes, reason, location
MAINTENANCE_REQUIRED	MaintenanceAgent	block_id, track_ids, reason, urgency
EMERGENCY_TRIGGERED	ConflictDetectionAgent / API	emergency_type, location, affected_trains, immediate_action
MOVEMENT_AUTHORITY_GRANTED	TrainDispatchAgent	train_number, max_speed, distance_km, until_track
Environment Variables
Table
Variable	Required	Default	Description
NEO4J_URI	Yes	—	Neo4j Aura connection URI
NEO4J_USERNAME	Yes	—	Neo4j username
NEO4J_PASSWORD	Yes	—	Neo4j password
HOST	No	0.0.0.0	Server bind host
PORT	No	8000	Server port
DEBUG	No	false	Enable debug mode + Swagger UI
LOG_LEVEL	No	INFO	Logging level
LOG_FORMAT	No	json	json or console
EVENT_BUS_WORKER_COUNT	No	4	Event bus async workers
WS_MAX_CONNECTIONS	No	1000	Max WebSocket clients
DIGITAL_TWIN_UPDATE_INTERVAL	No	1.0	Metrics aggregation interval (seconds)
License
Proprietary — RailMind AI Systems