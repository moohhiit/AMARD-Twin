"""
RailMind AI - Event Publisher.
Async publisher interface for emitting events to the shared event bus.
"""

import uuid
from datetime import datetime
from typing import Any, TYPE_CHECKING

from backend.event_bus.events import BaseEvent, EventType
from backend.core.logger import get_logger

if TYPE_CHECKING:
    from backend.event_bus.event_manager import EventManager

logger = get_logger("event_publisher")


class EventPublisher:
    """Publisher that enqueues events into the event manager's async queue."""

    def __init__(self, event_manager: "EventManager") -> None:
        self._event_manager = event_manager

    async def publish(
        self,
        event_type: EventType,
        source_agent: str,
        payload: dict[str, Any],
        correlation_id: str | None = None,
    ) -> BaseEvent:
        """Create an event and publish it to the event bus."""
        event = BaseEvent(
            event_type=event_type,
            event_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            source_agent=source_agent,
            correlation_id=correlation_id,
            payload=payload,
        )
        await self._event_manager.enqueue(event)
        logger.debug(
            "event_published",
            event_type=event_type.value,
            event_id=event.event_id,
            source=source_agent,
        )
        return event

    async def publish_batch(
        self,
        events: list[tuple[EventType, str, dict[str, Any]]],
        correlation_id: str | None = None,
    ) -> list[BaseEvent]:
        """Publish multiple events atomically."""
        published: list[BaseEvent] = []
        for event_type, source_agent, payload in events:
            event = await self.publish(event_type, source_agent, payload, correlation_id)
            published.append(event)
        logger.info(
            "event_batch_published",
            count=len(published),
            correlation_id=correlation_id,
        )
        return published