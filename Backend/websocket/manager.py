"""
RailMind AI - WebSocket Manager.
Live broadcast hub for digital twin updates with topic-based filtering.
"""

import asyncio
import json
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from backend.core.config import settings
from backend.core.logger import get_logger

logger = get_logger("websocket_manager")

# Topics that clients can subscribe to
VALID_TOPICS = {
    "train_positions",
    "route_changes",
    "platform_occupancy",
    "delay_updates",
    "signal_updates",
    "emergency_events",
    "all",
}


class Connection:
    """Represents a single WebSocket connection with topic subscriptions."""

    def __init__(self, websocket: WebSocket, client_id: str) -> None:
        self.websocket = websocket
        self.client_id = client_id
        self.topics: set[str] = {"all"}
        self.connected_at: float = asyncio.get_event_loop().time()


class WebSocketManager:
    """Manages WebSocket connections and broadcasts messages to subscribers."""

    def __init__(self) -> None:
        self._connections: dict[str, Connection] = {}
        self._counter: int = 0
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> str:
        """Accept a new WebSocket connection and return client ID."""
        await websocket.accept()
        self._counter += 1
        client_id = f"ws_client_{self._counter}"
        async with self._lock:
            self._connections[client_id] = Connection(websocket, client_id)
        logger.info(
            "websocket_connected",
            client_id=client_id,
            total_connections=len(self._connections),
        )
        return client_id

    async def disconnect(self, client_id: str) -> None:
        """Remove a WebSocket connection."""
        async with self._lock:
            if client_id in self._connections:
                del self._connections[client_id]
        logger.info(
            "websocket_disconnected",
            client_id=client_id,
            total_connections=len(self._connections),
        )

    async def set_topics(self, client_id: str, topics: list[str]) -> None:
        """Update topic subscriptions for a client."""
        valid = {t for t in topics if t in VALID_TOPICS}
        if not valid:
            valid = {"all"}
        async with self._lock:
            if client_id in self._connections:
                self._connections[client_id].topics = valid
        logger.debug(
            "websocket_topics_updated",
            client_id=client_id,
            topics=list(valid),
        )

    async def broadcast(self, topic: str, payload: dict[str, Any]) -> None:
        """Broadcast a message to all clients subscribed to the topic."""
        message = json.dumps(
            {
                "topic": topic,
                "timestamp": asyncio.get_event_loop().time(),
                "payload": payload,
            },
            default=str,
        )
        disconnected: list[str] = []

        async with self._lock:
            connections = list(self._connections.values())

        for conn in connections:
            if "all" in conn.topics or topic in conn.topics:
                try:
                    await conn.websocket.send_text(message)
                except Exception as exc:
                    logger.warning(
                        "websocket_send_failed",
                        client_id=conn.client_id,
                        error=str(exc),
                    )
                    disconnected.append(conn.client_id)

        for client_id in disconnected:
            await self.disconnect(client_id)

    async def send_to_client(
        self, client_id: str, payload: dict[str, Any]
    ) -> None:
        """Send a message to a specific client."""
        async with self._lock:
            conn = self._connections.get(client_id)
        if not conn:
            return
        message = json.dumps(payload, default=str)
        try:
            await conn.websocket.send_text(message)
        except Exception as exc:
            logger.warning(
                "websocket_direct_send_failed",
                client_id=client_id,
                error=str(exc),
            )
            await self.disconnect(client_id)

    async def handle_client(self, websocket: WebSocket) -> None:
        """Main handler for a WebSocket connection lifecycle."""
        client_id = await self.connect(websocket)
        try:
            while True:
                try:
                    data = await asyncio.wait_for(
                        websocket.receive_text(),
                        timeout=settings.WS_HEARTBEAT_INTERVAL,
                    )
                    msg = json.loads(data)
                    action = msg.get("action")
                    if action == "subscribe":
                        topics = msg.get("topics", ["all"])
                        await self.set_topics(client_id, topics)
                        await self.send_to_client(
                            client_id,
                            {
                                "type": "subscription_confirmed",
                                "topics": topics,
                            },
                        )
                    elif action == "ping":
                        await self.send_to_client(
                            client_id,
                            {"type": "pong", "client_id": client_id},
                        )
                    else:
                        await self.send_to_client(
                            client_id,
                            {
                                "type": "error",
                                "message": f"Unknown action: {action}",
                            },
                        )
                except asyncio.TimeoutError:
                    await self.send_to_client(
                        client_id,
                        {"type": "heartbeat", "timestamp": asyncio.get_event_loop().time()},
                    )
        except WebSocketDisconnect:
            logger.info("websocket_client_disconnected", client_id=client_id)
        except Exception as exc:
            logger.error(
                "websocket_error",
                client_id=client_id,
                error=str(exc),
            )
        finally:
            await self.disconnect(client_id)

    def get_metrics(self) -> dict[str, Any]:
        """Return current WebSocket connection metrics."""
        return {
            "active_connections": len(self._connections),
            "max_connections": settings.WS_MAX_CONNECTIONS,
            "topics": list(VALID_TOPICS),
        }


# Module-level singleton
websocket_manager = WebSocketManager()