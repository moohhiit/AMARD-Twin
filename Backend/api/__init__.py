"""RailMind AI API Routers Package."""
from backend.api.trains import router as trains_router
from backend.api.routes import router as routes_router
from backend.api.platforms import router as platforms_router
from backend.api.signals import router as signals_router
from backend.api.conflicts import router as conflicts_router
from backend.api.delays import router as delays_router
from backend.api.monitoring import router as monitoring_router

__all__ = [
    "trains_router",
    "routes_router",
    "platforms_router",
    "signals_router",
    "conflicts_router",
    "delays_router",
    "monitoring_router",
]