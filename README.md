# Railway Control Center - Intelligent Railway Management System

A production-grade intelligent railway control backend and real-time dashboard built with **Node.js**, **TypeScript**, **Neo4j** (graph database), **MongoDB** (document database), **Socket.IO** (real-time communication), and **React** (frontend dashboard). The system simulates real-time train movement across a railway network graph with two AI-powered decision agents: a **Dynamic Rerouting Agent** and a **Smart Platform Allocation Agent**.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Folder Structure](#folder-structure)
- [How It Works](#how-it-works)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [WebSocket Events](#websocket-events)
- [Database Schema](#database-schema)
- [Features Explained](#features-explained)
- [Demo Explanation](#demo-explanation)
- [Future Improvements](#future-improvements)

---

## Project Overview

This system is a **mini intelligent railway control center** that simulates real-time train movement across a network of stations, junctions, and track segments. Trains travel along shared and overlapping routes while the system continuously monitors track conditions, detects congestion, and makes intelligent decisions to optimize train flow.

### Key Capabilities

- **Real-time train movement simulation** with 5 trains on overlapping routes
- **Multiple trains on the same track** with safe following distance logic
- **Track capacity & congestion detection** with severity levels
- **Dynamic rerouting** via AI agent using Neo4j graph pathfinding (Dijkstra)
- **Smart platform allocation** via AI agent with multi-factor scoring
- **Real-time dashboard** with interactive SVG network map
- **WebSocket streaming** at 10Hz for live position updates
- **Dual database architecture**: Neo4j for network graph, MongoDB for train state

---

## Architecture

```
                    +-------------------+
                    |   React Dashboard |
                    |   (Vite + TS)     |
                    +---------+---------+
                              | Socket.IO
                    +---------v---------+
                    |   Express Server  |
                    |   (Node.js + TS)  |
                    +---------+---------+
                              |
            +-----------------+-----------------+
            |                                   |
    +-------v--------+                +---------v---------+
    |  Neo4j         |                |  MongoDB          |
    |  (Graph DB)    |                |  (Document DB)    |
    |                |                |                   |
    |  - Stations    |                |  - Trains         |
    |  - Junctions   |                |  - Train Events   |
    |  - Track Segs  |                |  - Platform Logs  |
    |  - Pathfinding |                |                   |
    +-------+--------+                +---------+---------+
            |                                   |
    +-------v--------+                +---------v---------+
    |  AI Agents       |                |  Movement Engine  |
    |                  |                |                   |
    |  - Rerouting     |                |  - Tick loop      |
    |  - Platform      |                |  - Position calc  |
    |                  |                |  - Congestion     |
    +------------------+                +-------------------+
```

### Data Flow

1. **Seed Phase**: Neo4j gets the network graph (7 nodes, 8 edges). MongoDB gets 5 trains and platform logs.
2. **Engine Phase**: The simulator runs a tick loop (100ms). Each tick:
   - Reads segment properties from in-memory cache (Neo4j at startup)
   - Computes new positions for all trains
   - Detects congestion by counting trains per segment
   - Triggers AI agents when thresholds are exceeded
   - Emits state updates via Socket.IO (10x/second per train)
3. **Agent Phase**: Async agents evaluate conditions:
   - **Rerouting Agent**: Queries Neo4j for alternative paths using congestion-weighted Dijkstra
   - **Platform Agent**: Scores available platforms using waiting time + congestion + compatibility
4. **Dashboard Phase**: React frontend receives WebSocket events and renders:
   - SVG network map with animated train markers
   - Live telemetry feed, agent decision log, alert panel

---

## Key Features

### Real-Time Engine
- Tick-based simulation running at 10Hz (100ms intervals)
- Configurable simulation speed (0.5x to 5x)
- Smooth train movement with CSS transition interpolation
- Speed calculation based on train capability, track limit, congestion, and safe following distance

### Track Capacity System
- Each track segment has a defined capacity (2-4 trains)
- Congestion severity levels: LOW (50%), MEDIUM (70%), HIGH (90%), CRITICAL (100%)
- Trains slow down on congested tracks (50% speed reduction)
- Trains stop on blocked tracks
- Visual warnings: amber dashed lines for congested, red dashed lines for blocked

### Dynamic Rerouting Agent
- **Trigger conditions**: delay > 5 min, track blocked, or congestion >= 90%
- **Algorithm**: Neo4j Cypher query with congestion-weighted edge costs (OPEN=1x, CONGESTED=2x, BLOCKED=100x)
- **Path scoring**: Considers travel time, number of segments, and congestion history
- **Cooldown**: 30 seconds between evaluations for the same train
- **Result**: New route saved, reroute event logged and emitted

### Smart Platform Allocation Agent
- **Trigger condition**: Train within 10km or 5 minutes of next station
- **Scoring formula**:
  - `waiting_time_score = min(minutes_free * 0.5, 10)`
  - `congestion_score = (1 - adjacent_congestion) * 10`
  - `length_score = min(length_margin / 50, 5)`
  - `proximity_score = max(0, (5 - platform_number) * 0.5)`
- **Wait state**: If no platform available, train enters WAIT status and retries every 10 seconds

### Real-Time Dashboard
- Dark-themed control center UI with blueprint grid background
- Interactive SVG network map with zoom, pan, and layer modes
- Animated track segments (dashed flow for congested/blocked)
- Pulsing station rings when trains are approaching
- Train detail cards on hover/select with speed, segment, delay info
- Three bottom panels: Live Telemetry, Agent Decisions, Active Alerts
- System status indicator with live clock

---

## Folder Structure

```
railway-control-center/
├── src/
│   ├── server/                    # Backend source
│   │   ├── agents/                # AI decision agents
│   │   │   ├── reroutingAgent.ts  # Dynamic rerouting (Neo4j pathfinding)
│   │   │   ├── platformAgent.ts   # Smart platform allocation
│   │   │   └── types.ts           # Agent interfaces
│   │   ├── config/
│   │   │   ├── neo4j.ts           # Neo4j driver setup
│   │   │   └── mongodb.ts         # Mongoose connection
│   │   ├── engine/
│   │   │   ├── movementEngine.ts  # Position/speed calculation
│   │   │   ├── trackManager.ts    # Occupancy & congestion
│   │   │   └── simulator.ts       # Main simulation loop
│   │   ├── models/
│   │   │   ├── mongo/             # Mongoose schemas
│   │   │   │   ├── Train.ts
│   │   │   │   ├── TrainEvent.ts
│   │   │   │   └── PlatformLog.ts
│   │   │   └── neo4j/
│   │   │       └── queries.ts     # Cypher query templates
│   │   ├── routes/
│   │   │   ├── trains.ts          # Train CRUD + live endpoint
│   │   │   ├── tracks.ts          # Track status endpoints
│   │   │   ├── stations.ts        # Station + platform endpoints
│   │   │   ├── routes.ts          # Pathfinding endpoints
│   │   │   └── simulation.ts      # Engine control endpoints
│   │   ├── services/
│   │   │   ├── trainService.ts    # Train business logic
│   │   │   ├── trackService.ts    # Track business logic
│   │   │   ├── stationService.ts  # Station business logic
│   │   │   ├── routeService.ts    # Pathfinding service
│   │   │   └── socketService.ts   # Socket.IO event management
│   │   ├── middleware/
│   │   │   └── errorHandler.ts    # Global error handling
│   │   ├── types/
│   │   │   └── index.ts           # Shared TypeScript types
│   │   ├── utils/
│   │   │   └── logger.ts          # Pino structured logging
│   │   └── app.ts                 # Express app + HTTP server
│   ├── sections/                  # Frontend dashboard sections
│   │   ├── Header.tsx             # Status bar + clock
│   │   ├── LeftControlPanel.tsx   # Controls + train list + stats
│   │   ├── NetworkMap.tsx         # SVG interactive map
│   │   └── BottomMetricsStrip.tsx # Telemetry + agents + alerts
│   ├── App.tsx                    # Main React app
│   ├── main.tsx                   # React entry point
│   └── index.css                  # Global styles + animations
├── scripts/
│   ├── seedNeo4j.ts               # Seed graph database
│   └── seedMongo.ts               # Seed document database
├── .env                           # Environment variables
├── package.json
├── tsconfig.json
└── README.md
```

---

## How It Works

### Step-by-Step

1. **Seed the databases**:
   ```bash
   npm run seed:neo4j   # Creates 5 stations, 2 junctions, 8 track segments in Neo4j
   npm run seed:mongo   # Creates 5 trains, platform logs in MongoDB
   ```

2. **Start the server**:
   ```bash
   npm run server       # Starts Express + Socket.IO + initializes simulator
   ```

3. **Start the simulation** (auto-starts with server):
   - The simulator begins a tick loop running every 100ms
   - Each tick computes new positions, checks congestion, runs agents
   - All state changes are emitted via Socket.IO

4. **Open the dashboard**:
   - The React frontend connects via Socket.IO
   - Receives real-time train position updates (10x/second)
   - Renders the interactive SVG network map
   - Displays agent decisions and alerts as they happen

5. **Observe AI agents in action**:
   - When congestion builds on a shared track, the Rerouting Agent finds alternative paths
   - When a train approaches a station, the Platform Agent assigns the best platform
   - All decisions appear in the Agent Activity panel with timestamps

---

## Setup Instructions

### Prerequisites

- **Node.js** 20+ and npm
- **Neo4j** 5.x (Community or Enterprise) running locally or accessible
- **MongoDB** 7.x running locally or accessible

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root (or use the provided one):

```env
PORT=3000
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
MONGODB_URI=mongodb://localhost:27017/railway_control
SIMULATION_SPEED=1
ENGINE_TICK_MS=100
LOG_LEVEL=info
```

### 3. Start Neo4j and MongoDB

Make sure both databases are running before seeding.

### 4. Seed the Databases

```bash
npm run seed
```

This runs both seed scripts in sequence:
- `seedNeo4j.ts`: Creates the railway network graph
- `seedMongo.ts`: Creates train and platform data

### 5. Start the Development Server

```bash
# Terminal 1: Start the backend
npm run server

# Terminal 2: Start the frontend dev server
npm run dev
```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:3000`.

### Production Build

```bash
npm run build          # Builds the React frontend to dist/
npm run server         # Serves frontend from dist/ + API
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | HTTP server port |
| `NEO4J_URI` | Yes | - | Neo4j Bolt URI (e.g., `bolt://localhost:7687`) |
| `NEO4J_USER` | Yes | - | Neo4j username |
| `NEO4J_PASSWORD` | Yes | - | Neo4j password |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `SIMULATION_SPEED` | No | 1.0 | Default simulation multiplier (0.5x - 5x) |
| `ENGINE_TICK_MS` | No | 100 | Engine tick interval in milliseconds |
| `LOG_LEVEL` | No | `info` | Pino log level (trace/debug/info/warn/error/fatal) |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin |
| `AGENT_REROUTE_DELAY_THRESHOLD` | No | 5 | Minutes of delay before rerouting triggers |
| `AGENT_PLATFORM_APPROACH_KM` | No | 10 | Distance to station for platform evaluation |

---

## API Endpoints

### Trains

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/trains` | List all trains with current state |
| `GET` | `/api/v1/trains/:id` | Get single train detail |
| `GET` | `/api/v1/trains/:id/live` | Get real-time position + telemetry |
| `GET` | `/api/v1/trains/:id/events` | Get event history for a train |
| `GET` | `/api/v1/trains/:id/route` | Get current planned route with segments |
| `PATCH` | `/api/v1/trains/:id/speed` | Override train speed |
| `PATCH` | `/api/v1/trains/:id/status` | Manually set train status |

### Tracks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/tracks` | List all track segments with status |
| `GET` | `/api/v1/tracks/:segmentId` | Get single track detail |
| `PATCH` | `/api/v1/tracks/:segmentId/status` | Set track status (OPEN/CONGESTED/BLOCKED) |
| `GET` | `/api/v1/tracks/congested` | Get currently congested tracks |

### Stations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/stations` | List all stations and junctions |
| `GET` | `/api/v1/stations/:id` | Get station detail |
| `GET` | `/api/v1/stations/:id/platforms` | Get platform status at a station |

### Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/routes/shortest?from=MUM&to=DEL` | Find shortest path (Dijkstra) |
| `GET` | `/api/v1/routes/fastest?from=MUM&to=DEL` | Find fastest path (A* with congestion) |

### Simulation Control

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/simulation/start` | Start the movement engine |
| `POST` | `/api/v1/simulation/pause` | Pause all train movement |
| `POST` | `/api/v1/simulation/resume` | Resume movement |
| `POST` | `/api/v1/simulation/reset` | Reset all trains |
| `PATCH` | `/api/v1/simulation/speed` | Set simulation speed multiplier |
| `GET` | `/api/v1/simulation/status` | Get engine status |

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with timestamp |

---

## WebSocket Events

### Client -> Server

| Event | Payload | Description |
|-------|---------|-------------|
| `client:subscribe:train` | `{ train_id: string }` | Subscribe to a specific train |
| `client:unsubscribe:train` | `{ train_id: string }` | Unsubscribe from a train |
| `client:subscribe:all` | `{}` | Subscribe to all train updates |
| `client:control:pause` | `{}` | Pause simulation |
| `client:control:resume` | `{}` | Resume simulation |

### Server -> Client

| Event | Payload | Frequency |
|-------|---------|-----------|
| `train:update` | `{ train_id, position, speed_kmh, status, delay_minutes, current_segment }` | Every 100ms per train |
| `train:rerouted` | `{ train_id, old_route, new_route, reason, trigger, estimated_delay_reduction_min }` | On reroute decision |
| `platform:assigned` | `{ train_id, station_id, platform_number, score_breakdown, eta }` | On platform assignment |
| `congestion:alert` | `{ segment_id, from_node, to_node, train_count, capacity, severity }` | On congestion detection |
| `track:blocked` | `{ segment_id, from_node, to_node, reason }` | On track block |
| `agent:decision` | `{ agent_type, train_id, decision, reason, timestamp }` | On any agent decision |
| `system:status` | `{ engine_running, simulation_speed, active_trains, congested_tracks }` | Every 5 seconds |

---

## Database Schema

### Neo4j (Graph Database)

**Nodes:**
- `Station` (`id`, `name`, `type`, `lat`, `lng`, `platforms`) - 5 stations
- `Junction` (`id`, `name`, `type`, `lat`, `lng`) - 2 junctions

**Relationships:**
- `CONNECTED_TO` (`segment_id`, `distance_km`, `max_speed_kmh`, `capacity`, `status`, `direction`) - 8 track segments

### MongoDB (Document Database)

**Collection: `trains`**
- `train_id` (string, unique) - e.g., "101"
- `name` (string) - e.g., "Mumbai Express"
- `type` (string) - "PASSENGER" | "FREIGHT" | "EXPRESS"
- `length_meters` (number) - Train physical length
- `max_speed_kmh` (number) - Maximum speed
- `current_speed_kmh` (number) - Real-time speed
- `status` (string) - "RUNNING" | "STOPPED" | "WAITING" | "ARRIVED" | "REROUTING"
- `route` (string[]) - Ordered list of station IDs
- `current_segment_index` (number) - Current position in route
- `position` (object) - `{ from_node, to_node, progress_percent, lat, lng }`
- `delay_minutes` (number) - Cumulative delay
- `assigned_platform` (number | null) - Platform assignment
- `reroute_count` (number) - Times rerouted
- `color` (string) - Display color

**Collection: `train_events`**
- `event_id` (string, unique) - UUID
- `train_id` (string)
- `event_type` (string) - DEPARTURE, ARRIVAL, REROUTE, PLATFORM_ASSIGNED, etc.
- `details` (object) - Event-specific details
- `source` (string) - ENGINE, REROUTING_AGENT, PLATFORM_AGENT, SYSTEM
- `timestamp` (Date)

**Collection: `platform_logs`**
- `station_id` (string)
- `platform_number` (number)
- `train_id` (string | null)
- `status` (string) - OCCUPIED, FREE, RESERVED
- `assigned_by` (string)
- `length_meters` (number)

---

## Features Explained

### Real-Time Engine

The movement engine is the heart of the simulation. It runs on a 100ms tick loop and:

1. Computes the time delta (adjusted by simulation speed)
2. For each running train:
   - Gets the current track segment properties
   - Calculates speed: `min(train.max_speed, track.max_speed)`
   - Applies congestion penalty (50% reduction)
   - Applies blocked track penalty (0 speed)
   - Checks safe following distance (stops if within 2km of train ahead)
   - Updates position progress along the segment
   - Advances to next segment when progress reaches 100%
3. Detects congestion by counting trains per segment
4. Emits updates via Socket.IO

### Track Capacity System

Each track segment has a capacity limit (2-4 trains). The system monitors occupancy and assigns severity:

| Occupancy | Status | Visual |
|-----------|--------|--------|
| < 50% | Normal | Solid gray line |
| 50-70% | LOW | Solid gray line |
| 70-90% | MEDIUM | Amber warning |
| 90-100% | HIGH | Amber dashed animated line |
| >= 100% | CRITICAL | Red dashed animated line |

### Rerouting Agent

When trigger conditions are met, the agent:

1. Queries Neo4j for all simple paths from current position to destination
2. Excludes currently congested/blocked segments
3. Computes weighted travel time per path:
   - `weight = (distance / speed) * congestion_multiplier`
   - OPEN: 1.0x, CONGESTED: 2.0x, BLOCKED: 100.0x
4. Scores paths by travel time + segment count + congestion history
5. Only reroutes if savings > 2 minutes
6. Updates the train's route and emits a `train:rerouted` event

### Platform Agent

When a train approaches a station (within 10km or 5 min ETA):

1. Gets all platforms at the destination station
2. Filters for FREE platforms that can fit the train's length
3. Scores each platform:
   - **Waiting time** (40%): Platforms free longer score higher
   - **Congestion** (30%): Less congested adjacent areas score higher
   - **Length compatibility** (20%): Extra margin scores higher
   - **Proximity** (10%): Lower platform numbers (closer to exit) score higher
4. Assigns the highest-scoring platform
5. If none available, sets train to WAIT status and retries every 10 seconds

---

## Demo Explanation

### How Trains Move

After starting the system (`npm run seed && npm run server`), 5 trains begin moving from their origin stations:

- **Train 101** (Mumbai Express): MUM -> J1 -> BLR -> CHN -> HYD -> J2 -> DEL
- **Train 102** (Deccan Queen): Same route as 101, departs 1 minute later
- **Train 103** (Rajdhani): DEL -> HYD -> CHN
- **Train 104** (Shatabdi): DEL -> HYD -> CHN -> BLR
- **Train 105** (Karnataka Exp): BLR -> HYD -> J2 -> DEL

Trains 101 and 102 share the MUM-DEL route, creating natural congestion. Trains 103 and 104 share DEL-HYD and HYD-CHN. Train 105 shares HYD-J2-DEL with 101/102.

### How Rerouting Happens

1. Watch for trains 101 and 102 - they start on the same route
2. As they share segments, congestion builds
3. When a segment hits 90%+ capacity, the Rerouting Agent triggers
4. Check the **Agent Activity** panel - you'll see a magenta entry:
   > "Train 102 diverted to alternative path. Reason: Track CHN-HYD-A congested. Alternative saves 8 min."
5. On the map, the rerouted train's new path appears as a dashed magenta line
6. The train marker pulses with a magenta ring during rerouting

### How Platform Assignment Works

1. As any train approaches its next station (within 10km), the Platform Agent activates
2. Check the **Agent Activity** panel - you'll see a cyan entry:
   > "Platform Agent - Train 101 assigned Platform 2 at DEL. Score: 18.5"
3. The score breakdown shows: waiting time, congestion score, length compatibility
4. If all platforms are occupied, the train enters WAIT state (shown in telemetry)

### How to Trigger Events Manually

Block a track to force rerouting:
```bash
curl -X PATCH http://localhost:3000/api/v1/tracks/CHN-HYD-A/status \
  -H "Content-Type: application/json" \
  -d '{"status": "BLOCKED"}'
```

Watch the dashboard:
- The track turns red with animated dashes
- A CRITICAL alert appears
- The Rerouting Agent finds a new path
- The train marker shows a magenta pulse

---

## Future Improvements

- **AI Prediction Models**: Use historical data to predict congestion before it happens
- **Weather Impact Integration**: Factor in weather conditions (rain, fog) that affect speed
- **Passenger Load Optimization**: Optimize platform assignment based on passenger density
- **Historical Analytics Dashboard**: Show trends, average delays, busiest segments over time
- **Multi-Server Scaling**: Support distributed simulation across multiple nodes
- **WebRTC Video Feeds**: Integrate live camera feeds from stations
- **Mobile App**: Companion mobile app for on-the-go monitoring
- **Machine Learning**: Train models on simulation data to improve agent decisions

---

## License

MIT
