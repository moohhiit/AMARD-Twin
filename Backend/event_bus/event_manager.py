"""
RailMind AI - Event Manager.
Central async event bus orchestrator with queue-based processing.
"""

import asyncio
from typing import Any, Callable

from backend.core.config import settings
from backend.core.logger import get_logger
from backend.event_bus.events import BaseEvent, EventType
from backend.event_bus.publisher import EventPublisher
from backend.event_bus.subscriber import EventHandler, EventSubscriber

logger = get_logger("event_manager")


class EventManager:
    """Singleton async event bus supporting publish, subscribe, and background processing."""

    _instance: "EventManager | None" = None

    def __new__(cls) -> "EventManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._queue: asyncio.Queue[BaseEvent] = asyncio.Queue(
            maxsize=settings.EVENT_BUS_MAX_QUEUE_SIZE
        )
        self._subscriber = EventSubscriber()
        self._publisher = EventPublisher(self)
        self._workers: list[asyncio.Task[Any]] = []
        self._running: bool = False
        self._initialized = True

    @property
    def publisher(self) -> EventPublisher:
        """Return the event publisher."""
        return self._publisher

    @property
    def subscriber(self) -> EventSubscriber:
        """Return the event subscriber registry."""
        return self._subscriber

    async def enqueue(self, event: BaseEvent) -> None:
        """Add an event to the processing queue."""
        try:
            self._queue.put_nowait(event)
            logger.debug(
                "event_enqueued",
                event_type=event.event_type.value,
                event_id=event.event_id,
                queue_size=self._queue.qsize(),
            )
        except asyncio.QueueFull:
            logger.error(
                "event_queue_full",
                event_type=event.event_type.value,
                event_id=event.event_id,
                max_size=settings.EVENT_BUS_MAX_QUEUE_SIZE,
            )
            raise RuntimeError("Event bus queue is full") from None

    def subscribe(
        self,
        event_type: EventType,
        handler: EventHandler,
        filter_fn: Callable[[BaseEvent], bool] | None = None,
    ) -> str:
        """Register a handler for an event type."""
        return self._subscriber.subscribe(event_type, handler, filter_fn)

    def unsubscribe(self, subscription_id: str) -> bool:
        """Remove a subscription."""
        return self._subscriber.unsubscribe(subscription_id)

    async def start(self) -> None:
        """Start background worker tasks to process events."""
        if self._running:
            return
        self._running = True
        worker_count = settings.EVENT_BUS_WORKER_COUNT
        for i in range(worker_count):
            task = asyncio.create_task(
                self._worker_loop(f"worker_{i}"),
                name=f"event_worker_{i}",
            )
            self._workers.append(task)
        logger.info(
            "event_bus_started",
            workers=worker_count,
            max_queue_size=settings.EVENT_BUS_MAX_QUEUE_SIZE,
        )

    async def stop(self) -> None:
        """Stop all background workers gracefully."""
        if not self._running:
            return
        self._running = False
        for worker in self._workers:
            worker.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()
        logger.info("event_bus_stopped")

    async def _worker_loop(self, worker_name: str) -> None:
        """Continuously process events from the queue."""
        while self._running:
            try:
                event = await self._queue.get()
                self._queue.task_done()
                await self._subscriber.dispatch(event)
            except asyncio.CancelledError:
                logger.info("event_worker_cancelled", worker=worker_name)
                break
            except Exception as exc:
                logger.error(
                    "event_processing_error",
                    worker=worker_name,
                    error=str(exc),
                    event_type=getattr(event, "event_type", "UNKNOWN"),
                )

    async def drain(self) -> None:
        """Wait for all queued events to be processed."""
        await self._queue.join()
        logger.info("event_queue_drained")

    def get_metrics(self) -> dict[str, Any]:
        """Return current event bus metrics."""
        return {
            "queue_size": self._queue.qsize(),
            "max_queue_size": settings.EVENT_BUS_MAX_QUEUE_SIZE,
            "workers": len(self._workers),
            "running": self._running,
            "subscriber_counts": {
                et.value: self._subscriber.get_subscriber_count(et)
                for et in EventType
            },
        }


# Module-level singleton
event_manager = EventManager()