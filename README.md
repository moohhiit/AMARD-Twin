# AMARD — Autonomous Multi-Agent Railway Dispatcher

A real-time railway control and simulation system powered by a multi-agent architecture. AMARD models train movement, platform scheduling, signal management, collision avoidance, and dynamic rerouting across a live graph-based railway network.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Startup Flow](#startup-flow)
- [Simulation Parameters](#simulation-parameters)
- [Scripts](#scripts)

---

## Overview

AMARD is a full-stack simulation platform for railway operations. It maintains a live digital twin of a railway network where trains move autonomously, respond to signals, avoid collisions, adapt to weather conditions, and get rerouted when delays occur — all in real time.

The backend runs a tick-based simulation engine that continuously computes train positions, manages platform occupancy, evaluates signal states, and dispatches events over WebSocket to a React dashboard. The graph structure of the railway network (stations and tracks) is stored in Neo4j, while operational data (trains, schedules, event logs) lives in MongoDB.

---

## Tech Stack

**Backend**
- [Node.js](https://nodejs.org) + [TypeScript](https://www.typescriptlang.org/)
- [Express v5](https://expressjs.com/) — REST API
- [Socket.IO](https://socket.io/) — real-time WebSocket communication
- [MongoDB](https://www.mongodb.com/) + [Mongoose](https://mongoosejs.com/) — train and event data
- [Neo4j](https://neo4j.com/) — graph model of stations and tracks
- [Pino](https://getpino.io/) — structured logging

**Frontend**
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — build tool
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [Recharts](https://recharts.org/) — data visualisation
- [Socket.IO Client](https://socket.io/docs/v4/client-api/) — live updates
- [Radix UI](https://www.radix-ui.com/) + [shadcn/ui](https://ui.shadcn.com/) — component primitives
- [React Router v7](https://reactrouter.com/) — client-side routing

---

## Project Structure

```
AMARD-Twin/
├── backend/
│   ├── scripts/
│   │   ├── seedMongo.ts       # Seeds train and schedule data into MongoDB
│   │   └── seedNeo4j.ts       # Seeds station and track graph into Neo4j
│   └── src/server/
│       ├── agents/
│       │   ├── platformAgent.ts      # Manages platform arrival/departure logic
│       │   └── reroutingAgent.ts     # Triggers reroutes on delay thresholds
│       ├── config/
│       │   ├── mongodb.ts            # MongoDB connection
│       │   └── neo4j.ts              # Neo4j driver setup
│       ├── engine/
│       │   ├── simulator.ts          # Core simulation orchestrator
│       │   ├── loopManager.ts        # Tick loop (ENGINE_TICK_MS cadence)
│       │   ├── movementEngine.ts     # Train position and speed computation
│       │   ├── scheduleManager.ts    # Departure/arrival schedule tracking
│       │   ├── signalSystem.ts       # Signal state evaluation
│       │   ├── collisionSystem.ts    # Safety distance enforcement
│       │   ├── trackManager.ts       # Track occupancy and routing
│       │   └── weatherEngine.ts      # Weather effects on speed/signals
│       ├── models/
│       │   ├── mongo/                # Mongoose schemas (Train, TrainEvent, PlatformLog)
│       │   └── neo4j/queries.ts      # Cypher query definitions
│       ├── routes/                   # REST endpoints (trains, stations, tracks, simulation, dashboard)
│       ├── services/
│       │   ├── socketService.ts      # WebSocket event broadcasting
│       │   ├── stationService.ts     # Station state management
│       │   └── routeService.ts       # Route resolution via Neo4j graph
│       ├── middleware/
│       │   └── errorHandler.ts
│       └── app.ts                    # Express + Socket.IO server entry point
│
└── frontend/
    └── src/                          # React dashboard (live map, train list, charts, controls)
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or later
- A running **MongoDB** instance (Atlas or local)
- A running **Neo4j** instance (Aura or local)

### Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
PORT=3000

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
MONGODB_DB_NAME=railway_control

# Neo4j
NEO4J_URI=neo4j+s://<your-instance>.databases.neo4j.io
NEO4J_USER=<username>
NEO4J_PASSWORD=<password>

# Simulation
SIMULATION_SPEED=1
ENGINE_TICK_MS=100
LOG_LEVEL=info
CORS_ORIGIN=*

# Agent Behaviour
AGENT_REROUTE_DELAY_THRESHOLD=5
AGENT_PLATFORM_APPROACH_KM=10
AGENT_PLATFORM_APPROACH_TIME_MIN=5
AGENT_DEPARTURE_PREPARE_TIME_MIN=3
AGENT_DEPARTURE_PREPARE_TIME_MAX=7
AGENT_MIN_SPEED_KMH=30
AGENT_MAX_SPEED_KMH=120
AGENT_ACCELERATION_KMH_PER_S=10
AGENT_DECELERATION_KMH_PER_S=15
AGENT_SAFETY_DISTANCE_M=100
AGENT_MAX_WAIT_TIME_MIN=10
AGENT_MIN_WAIT_TIME_MIN=2
AGENT_REROUTE_PROBABILITY=0.3
AGENT_RANDOM_SEED=42
```

> **Important:** Never commit your `.env` file. It is already listed in `.gitignore`.

---

### Backend Setup

Open a terminal and run:

```bash
cd backend
npm install

# First time only — seed both databases
npm run seed

# Start in development mode (auto-restarts on file changes)
npm run dev

# OR start in production mode
npm start
```

The backend will be available at `http://localhost:3000`.

The simulation engine starts in an **idle state** and only begins once the frontend sends a `POST /api/v1/simulation/start` request.

---

### Frontend Setup

Open a second terminal and run:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

On first load, a **"Waking up server…"** overlay appears. This is by design — the frontend polls `GET /health` every 2 seconds until the backend is ready, then automatically triggers the simulation and dismisses the overlay.

---

## Startup Flow

```
1. Start backend     →  MongoDB + Neo4j connect  →  Engine enters idle state
2. Start frontend    →  "Waking up server" overlay shown
                     →  Polls GET /health every 2 seconds
                     →  Backend responds healthy
                     →  Frontend sends POST /api/v1/simulation/start
                     →  Engine begins tick loop
                     →  Overlay dismissed, dashboard goes live
```

---

## Simulation Parameters

| Variable | Default | Description |
|---|---|---|
| `ENGINE_TICK_MS` | `100` | How often the simulation updates (milliseconds) |
| `SIMULATION_SPEED` | `1` | Speed multiplier for the simulation clock |
| `AGENT_MAX_SPEED_KMH` | `120` | Maximum train speed |
| `AGENT_SAFETY_DISTANCE_M` | `100` | Minimum safe distance between trains |
| `AGENT_REROUTE_DELAY_THRESHOLD` | `5` | Minutes of delay before rerouting is triggered |
| `AGENT_REROUTE_PROBABILITY` | `0.3` | Probability that a rerouting agent intervenes |
| `AGENT_RANDOM_SEED` | `42` | Seed for reproducible simulation behaviour |

---

## Scripts

| Command | Location | Description |
|---|---|---|
| `npm run dev` | `backend/` | Start backend with hot-reload (nodemon + tsx) |
| `npm start` | `backend/` | Start backend in production mode |
| `npm run seed` | `backend/` | Seed both MongoDB and Neo4j |
| `npm run seed:mongo` | `backend/` | Seed MongoDB only |
| `npm run seed:neo4j` | `backend/` | Seed Neo4j only |
| `npm run dev` | `frontend/` | Start Vite dev server |
| `npm run build` | `frontend/` | Type-check and build for production |
| `npm run lint` | `frontend/` | Run ESLint |
