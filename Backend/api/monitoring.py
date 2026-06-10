"""
RailMind AI - Monitoring API Router.
Digital twin state, network metrics, and live event streaming.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from backend.services.monitoring_service import MonitoringService
from backend.agents.monitoring_agent import NetworkMonitoringAgent
from backend.core.logger import get_logger

logger = get_logger("api.monitoring")
router = APIRouter(prefix="/network-state", tags=["Monitoring"])


def get_monitoring_agent() -> NetworkMonitoringAgent:
    from backend.main import monitoring_agent
    return monitoring_agent


def get_monitoring_service(
    agent: NetworkMonitoringAgent = Depends(get_monitoring_agent),
) -> MonitoringService:
    return MonitoringService(agent)


@router.get("")
async def get_network_state(
    service: MonitoringService = Depends(get_monitoring_service),
) -> JSONResponse:
    """Retrieve the complete current network state from the graph."""
    data = await service.get_network_state()
    return JSONResponse(content=data)


@router.get("/trains")
async def get_train_positions(
    service: MonitoringService = Depends(get_monitoring_service),
) -> JSONResponse:
    """Get current positions of all trains."""
    positions = await service.get_train_positions()
    return JSONResponse(content={
        "trains": positions,
        "count": len(positions),
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    })


@router.get("/metrics")
async def get_system_metrics(
    service: MonitoringService = Depends(get_monitoring_service),
) -> JSONResponse:
    """Get aggregated system metrics from the digital twin."""
    data = await service.get_system_metrics()
    return JSONResponse(content=data)


@router.get("/digital-twin")
async def get_digital_twin(
    service: MonitoringService = Depends(get_monitoring_service),
) -> JSONResponse:
    """Get a snapshot of the digital twin state."""
    data = service.get_digital_twin_snapshot()
    return JSONResponse(content=data)


@router.get("/events")
async def get_recent_events(
    limit: int = 50,
    event_type: str | None = None,
    service: MonitoringService = Depends(get_monitoring_service),
) -> JSONResponse:
    """Get recent system events."""
    events = await service.get_recent_events(limit=limit, event_type=event_type)
    return JSONResponse(content={
        "events": events,
        "count": len(events),
        "limit": limit,
        "event_type": event_type,
    })


@router.get("/events/stats")
async def get_event_stats() -> JSONResponse:
    """Get event statistics from the graph."""
    query = """
    CALL {
        MATCH (e:Event)
        RETURN count(e) AS total
    }
    CALL {
        MATCH (e:Event)
        RETURN e.event_type AS type, count(e) AS count
    }
    CALL {
        MATCH (e:Event)
        RETURN e.severity AS severity, count(e) AS count
    }
    CALL {
        MATCH (e:Event)
        WHERE e.resolved = false
        RETURN count(e) AS unresolved
    }
    CALL {
        MATCH (e:Event)
        RETURN avg(e.delay_minutes) AS avg_delay
    }
    RETURN {
        total_events: total,
        by_type: apoc.map.fromPairs(collect([type, count])),
        by_severity: apoc.map.fromPairs(collect([severity, count])),
        unresolved_count: unresolved,
        average_delay_minutes: avg_delay
    } AS stats
    """
    from backend.graph.neo4j_client import neo4j_manager
    result = await neo4j_manager.execute_read(query)
    stats = result[0]["stats"] if result else {}
    return JSONResponse(content={
        "total_events": stats.get("total_events", 0),
        "by_type": stats.get("by_type", {}),
        "by_severity": stats.get("by_severity", {}),
        "unresolved_count": stats.get("unresolved_count", 0),
        "average_delay_minutes": round(stats.get("average_delay_minutes", 0), 2),
    })