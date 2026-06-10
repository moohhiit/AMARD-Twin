"""
RailMind AI - BaseAgent.
Abstract foundation for all multi-agents. Enforces event-bus-only communication.
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Any, Callable

from backend.event_bus.event_manager import EventManager, event_manager
from backend.event_bus.events import BaseEvent, EventType
from backend.core.logger import get_logger

logger = get_logger("base_agent")


class BaseAgent(ABC):
    """
    Abstract base class for all RailMind AI agents.
    
    Rules:
    1. Agents NEVER call each other directly.
    2. Agents communicate ONLY through the Event Bus.
    3. Each agent runs its own async event loop integration.
    """

    def __init__(self, agent_name: str) -> None:
        self.agent_name: str = agent_name
        self.agent_id: str = f"{agent_name}_{id(self)}"
        self._event_manager: EventManager = event_manager
        self._subscriptions: list[str] = []
        self._running: bool = False
        self._task: asyncio.Task[Any] | None = None
        self._logger = get_logger(agent_name)

    @property
    def event_manager(self) -> EventManager:
        """Access the singleton event bus."""
        return self._event_manager

    async def publish(
        self,
        event_type: EventType,
        payload: dict[str, Any],
        correlation_id: str | None = None,
    ) -> BaseEvent:
        """Publish an event to the shared event bus."""
        event = await self._event_manager.publisher.publish(
            event_type=event_type,
            source_agent=self.agent_name,
            payload=payload,
            correlation_id=correlation_id,
        )
        self._logger.debug(
            "agent_published_event",
            event_type=event_type.value,
            event_id=event.event_id,
        )
        return event

    def subscribe(
        self,
        event_type: EventType,
        handler: Callable[[BaseEvent], Any],
        filter_fn: Callable[[BaseEvent], bool] | None = None,
    ) -> str:
        """Subscribe to an event type on the shared bus."""
        sub_id = self._event_manager.subscribe(
            event_type=event_type,
            handler=handler,
            filter_fn=filter_fn,
        )
        self._subscriptions.append(sub_id)
        self._logger.info(
            "agent_subscribed",
            event_type=event_type.value,
            subscription_id=sub_id,
        )
        return sub_id

    def unsubscribe(self, subscription_id: str) -> bool:
        """Remove a specific subscription."""
        result = self._event_manager.unsubscribe(subscription_id)
        if result and subscription_id in self._subscriptions:
            self._subscriptions.remove(subscription_id)
        return result

    async def start(self) -> None:
        """Start the agent and register all event subscriptions."""
        if self._running:
            return
        self._running = True
        await self._register_handlers()
        self._task = asyncio.create_task(
            self._run_loop(),
            name=f"agent_loop_{self.agent_name}",
        )
        self._logger.info("agent_started", agent_id=self.agent_id)

    async def stop(self) -> None:
        """Stop the agent and clean up all subscriptions."""
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        for sub_id in list(self._subscriptions):
            self.unsubscribe(sub_id)
        self._subscriptions.clear()
        self._logger.info("agent_stopped", agent_id=self.agent_id)

    @abstractmethod
    async def _register_handlers(self) -> None:
        """
        Register all event subscriptions for this agent.
        Called once during start().
        """

    @abstractmethod
    async def _run_loop(self) -> None:
        """
        Main agent processing loop.
        Override for periodic tasks or background processing.
        """

    @abstractmethod
    async def handle_event(self, event: BaseEvent) -> None:
        """
        Process an incoming event.
        Override in subclasses for specific event handling logic.
        """