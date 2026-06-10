"""
RailMind AI - Event Subscriber.
Subscription registry and async callback dispatch with error isolation.
"""

import asyncio
from collections import defaultdict
from typing import Any, Awaitable, Callable

from backend.event_bus.events import BaseEvent, EventType
from backend.core.logger import get_logger

logger = get_logger("event_subscriber")

EventHandler = Callable[[BaseEvent], Awaitable[Any]]


class Subscription:
    """Represents a single subscription to an event type."""

    def __init__(
        self,
        event_type: EventType,
        handler: EventHandler,
        subscriber_id: str,
        filter_fn: Callable[[BaseEvent], bool] | None = None,
    ) -> None:
        self.event_type = event_type
        self.handler = handler
        self.subscriber_id = subscriber_id
        self.filter_fn = filter_fn


class EventSubscriber:
    """Registry for event subscriptions with async dispatch."""

    def __init__(self) -> None:
        self._subscriptions: dict[EventType, list[Subscription]] = defaultdict(list)
        self._subscriber_counter: int = 0

    def subscribe(
        self,
        event_type: EventType,
        handler: EventHandler,
        filter_fn: Callable[[BaseEvent], bool] | None = None,
    ) -> str:
        """Register a handler for a specific event type. Returns subscription ID."""
        self._subscriber_counter += 1
        sub_id = f"sub_{self._subscriber_counter}_{event_type.value}"
        subscription = Subscription(
            event_type=event_type,
            handler=handler,
            subscriber_id=sub_id,
            filter_fn=filter_fn,
        )
        self._subscriptions[event_type].append(subscription)
        logger.info(
            "subscription_registered",
            subscriber_id=sub_id,
            event_type=event_type.value,
        )
        return sub_id

    def unsubscribe(self, subscription_id: str) -> bool:
        """Remove a subscription by its ID."""
        for event_type, subs in self._subscriptions.items():
            for idx, sub in enumerate(subs):
                if sub.subscriber_id == subscription_id:
                    subs.pop(idx)
                    logger.info(
                        "subscription_removed",
                        subscriber_id=subscription_id,
                        event_type=event_type.value,
                    )
                    return True
        logger.warning("subscription_not_found", subscriber_id=subscription_id)
        return False

    async def dispatch(self, event: BaseEvent) -> None:
        """Dispatch an event to all matching subscribers with error isolation."""
        handlers = self._subscriptions.get(event.event_type, [])
        if not handlers:
            logger.debug(
                "no_subscribers_for_event",
                event_type=event.event_type.value,
                event_id=event.event_id,
            )
            return

        tasks: list[asyncio.Task[Any]] = []
        for sub in handlers:
            if sub.filter_fn is not None and not sub.filter_fn(event):
                continue
            task = asyncio.create_task(
                self._invoke_handler(sub, event),
                name=f"handler_{sub.subscriber_id}_{event.event_id}",
            )
            tasks.append(task)

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for idx, result in enumerate(results):
                if isinstance(result, Exception):
                    sub = handlers[idx]
                    logger.error(
                        "handler_error",
                        subscriber_id=sub.subscriber_id,
                        event_type=event.event_type.value,
                        event_id=event.event_id,
                        error=str(result),
                    )

    async def _invoke_handler(self, subscription: Subscription, event: BaseEvent) -> None:
        """Invoke a single handler with timeout protection."""
        try:
            await asyncio.wait_for(
                subscription.handler(event),
                timeout=10.0,
            )
            logger.debug(
                "handler_executed",
                subscriber_id=subscription.subscriber_id,
                event_type=event.event_type.value,
                event_id=event.event_id,
            )
        except asyncio.TimeoutError:
            logger.error(
                "handler_timeout",
                subscriber_id=subscription.subscriber_id,
                event_type=event.event_type.value,
                event_id=event.event_id,
            )
            raise

    def get_subscriber_count(self, event_type: EventType | None = None) -> int:
        """Return the number of active subscribers."""
        if event_type is None:
            return sum(len(subs) for subs in self._subscriptions.values())
        return len(self._subscriptions.get(event_type, []))