"""
RailMind AI - FastAPI Application Entry Point.
Production-ready application with agent lifecycle, WebSocket, and REST API.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, WebSocket, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.core.config import settings
from backend.core.logger import configure_logging, get_logger
from backend.graph.neo4j_client import neo4j_manager
from backend.event_bus.event_manager import event_manager
from backend.websocket.manager import websocket_manager
from backend.agents import (
    PlatformAllocationAgent,
    RouteAllocationAgent,
    SignalControlAgent,
    LoopLineAgent,
    DelayPropagationAgent,
    ConflictDetectionAgent,
    TrainDispatchAgent,
    MaintenanceAgent,
    EmergencyResponseAgent,
    NetworkMonitoringAgent,
)
from backend.api import (
    trains_router,
    routes_router,
    platforms_router,
    signals_router,
    conflicts_router,
    delays_router,
    monitoring_router,
)

agents: list = []
monitoring_agent: NetworkMonitoringAgent | None = None

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown."""
    configure_logging()
    logger.info(
        "application_startup",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )

    await neo4j_manager.connect()
    logger.info("neo4j_connected")

    await event_manager.start()
    logger.info("event_bus_started")

    global agents, monitoring_agent

    monitoring_agent = NetworkMonitoringAgent()
    agents = [
        PlatformAllocationAgent(),
        RouteAllocationAgent(),
        SignalControlAgent(),
        LoopLineAgent(),
        DelayPropagationAgent(),
        ConflictDetectionAgent(),
        TrainDispatchAgent(),
        MaintenanceAgent(),
        EmergencyResponseAgent(),
        monitoring_agent,
    ]

    for agent in agents:
        try:
            await agent.start()
            logger.info("agent_started", agent=agent.agent_name)
        except Exception as exc:
            logger.error("agent_start_failed", agent=agent.agent_name, error=str(exc))

    from backend.event_bus.events import EventType

    async def websocket_broadcast_handler(event) -> None:
        topic_map = {
            EventType.TRAIN_APPROACHING: "train_positions",
            EventType.TRAIN_DELAYED: "delay_updates",
            EventType.SIGNAL_GREEN: "signal_updates",
            EventType.SIGNAL_RED: "signal_updates",
            EventType.ROUTE_ASSIGNED: "route_changes",
            EventType.ROUTE_CLEAR: "route_changes",
            EventType.PLATFORM_ASSIGNED: "platform_occupancy",
            EventType.EMERGENCY_TRIGGERED: "emergency_events",
            EventType.MOVEMENT_AUTHORITY_GRANTED: "train_positions",
            EventType.ROUTE_CONFLICT: "emergency_events",
        }
        topic = topic_map.get(event.event_type, "all")
        await websocket_manager.broadcast(
            topic,
            {
                "event_type": event.event_type.value,
                "source_agent": event.source_agent,
                "payload": event.payload,
                "timestamp": event.timestamp.isoformat(),
                "event_id": event.event_id,
            },
        )

    for event_type in EventType:
        event_manager.subscribe(event_type, websocket_broadcast_handler)

    logger.info("all_agents_started", count=len(agents))

    yield

    # Shutdown
    logger.info("application_shutdown_initiated")

    for agent in agents:
        try:
            await agent.stop()
            logger.info("agent_stopped", agent=agent.agent_name)
        except Exception as exc:
            logger.error("agent_stop_failed", agent=agent.agent_name, error=str(exc))

    try:
        await event_manager.stop()
    except Exception as exc:
        logger.error("event_bus_stop_failed", error=str(exc))

    try:
        await neo4j_manager.close()
    except Exception as exc:
        logger.error("neo4j_close_failed", error=str(exc))

    logger.info("application_shutdown_complete")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered Railway Traffic Management and Digital Twin System",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trains_router, prefix="/api/v1")
app.include_router(routes_router, prefix="/api/v1")
app.include_router(platforms_router, prefix="/api/v1")
app.include_router(signals_router, prefix="/api/v1")
app.include_router(conflicts_router, prefix="/api/v1")
app.include_router(delays_router, prefix="/api/v1")
app.include_router(monitoring_router, prefix="/api/v1")


@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check() -> dict[str, Any]:
    """Health check endpoint for load balancers and monitoring."""
    neo4j_healthy = await neo4j_manager.health_check()
    return {
        "status": "healthy" if neo4j_healthy else "degraded",
        "neo4j": "connected" if neo4j_healthy else "disconnected",
        "event_bus": {
            "running": event_manager._running,
            "queue_size": event_manager._queue.qsize(),
            "workers": len(event_manager._workers),
        },
        "agents": [
            {
                "name": agent.agent_name,
                "running": agent._running,
            }
            for agent in agents
        ],
        "websocket": websocket_manager.get_metrics(),
    }


@app.get("/metrics", status_code=status.HTTP_200_OK)
async def metrics() -> dict[str, Any]:
    """System metrics endpoint."""
    if monitoring_agent is None:
        return {"error": "Monitoring agent not initialized"}
    return await monitoring_agent.get_live_metrics()


@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Live WebSocket endpoint for real-time digital twin updates."""
    await websocket_manager.handle_client(websocket)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc) -> JSONResponse:
    """Global exception handler for unhandled errors."""
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        error_type=type(exc).__name__,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "type": type(exc).__name__,
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=settings.WORKERS,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=False,
    )