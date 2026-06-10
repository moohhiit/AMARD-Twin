# RailMind AI

**AI-powered Railway Traffic Management and Digital Twin System**

## Technology Stack

- Python 3.12+
- FastAPI
- Neo4j Aura Free
- AsyncIO
- WebSockets
- Pydantic v2
- Structured Logging (structlog)
- Event-Driven Multi-Agent Architecture

## Architecture

RailMind AI uses a **strict event-driven multi-agent architecture**:

- **Agents NEVER call each other directly**
- **Agents communicate ONLY through the Event Bus**
- **Event Bus supports Publish, Subscribe, and Async Processing**
- **NetworkMonitoringAgent acts as Digital Twin Coordinator**

## Quick Start

### 1. Environment Setup

```bash
cp .env.example .env
# Edit .env with your Neo4j Aura credentials