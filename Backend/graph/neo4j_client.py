"""
RailMind AI - Neo4j Singleton Connection Manager.
Production-ready async graph database client with connection pooling.
"""

import asyncio
from typing import Any, Awaitable, Callable, TypeVar

from neo4j import AsyncGraphDatabase, AsyncDriver, AsyncSession
from neo4j.exceptions import Neo4jError, ServiceUnavailable

from backend.core.config import settings
from backend.core.logger import get_logger

logger = get_logger("neo4j_client")
T = TypeVar("T")


class Neo4jConnectionManager:
    """Singleton async Neo4j connection manager."""

    _instance: "Neo4jConnectionManager | None" = None
    _lock: asyncio.Lock = asyncio.Lock()

    def __new__(cls) -> "Neo4jConnectionManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._driver: AsyncDriver | None = None
        self._initialized = True

    async def connect(self) -> None:
        """Initialize the Neo4j async driver with connection pooling."""
        if self._driver is not None:
            return

        try:
            self._driver = AsyncGraphDatabase.driver(
                uri=settings.NEO4J_URI,
                auth=settings.neo4j_auth,
                max_connection_pool_size=settings.NEO4J_MAX_CONNECTION_POOL_SIZE,
                connection_timeout=settings.NEO4J_CONNECTION_TIMEOUT,
            )
            await self._driver.verify_connectivity()
            logger.info(
                "neo4j_connection_established",
                uri=settings.NEO4J_URI,
                pool_size=settings.NEO4J_MAX_CONNECTION_POOL_SIZE,
            )
        except ServiceUnavailable as exc:
            logger.error("neo4j_connection_failed", error=str(exc))
            raise RuntimeError(f"Failed to connect to Neo4j: {exc}") from exc

    async def execute_read(
        self,
        query: str,
        parameters: dict[str, Any] | None = None,
        database: str | None = None,
    ) -> list[dict[str, Any]]:
        """Execute a read transaction with automatic retry logic."""
        if self._driver is None:
            await self.connect()

        async def _tx_work(tx: Any) -> list[dict[str, Any]]:
            result = await tx.run(query, parameters or {})
            records = await result.data()
            return records

        try:
            async with self._driver.session(database=database) as session:
                records = await session.execute_read(_tx_work)
                logger.debug(
                    "neo4j_read_executed",
                    query=query[:100],
                    parameters=parameters,
                    record_count=len(records),
                )
                return records
        except Neo4jError as exc:
            logger.error(
                "neo4j_read_error",
                query=query[:100],
                error=str(exc),
                code=exc.code,
            )
            raise

    async def execute_write(
        self,
        query: str,
        parameters: dict[str, Any] | None = None,
        database: str | None = None,
    ) -> list[dict[str, Any]]:
        """Execute a write transaction with automatic retry logic."""
        if self._driver is None:
            await self.connect()

        async def _tx_work(tx: Any) -> list[dict[str, Any]]:
            result = await tx.run(query, parameters or {})
            records = await result.data()
            summary = await result.consume()
            logger.debug(
                "neo4j_write_consumed",
                counters=summary.counters.__dict__ if summary.counters else {},
            )
            return records

        try:
            async with self._driver.session(database=database) as session:
                records = await session.execute_write(_tx_work)
                logger.info(
                    "neo4j_write_executed",
                    query=query[:100],
                    parameters=parameters,
                    record_count=len(records),
                )
                return records
        except Neo4jError as exc:
            logger.error(
                "neo4j_write_error",
                query=query[:100],
                error=str(exc),
                code=exc.code,
            )
            raise

    async def close(self) -> None:
        """Close the Neo4j driver and release all connections."""
        if self._driver is not None:
            await self._driver.close()
            self._driver = None
            logger.info("neo4j_connection_closed")

    async def health_check(self) -> bool:
        """Verify database connectivity."""
        if self._driver is None:
            return False
        try:
            await self._driver.verify_connectivity()
            return True
        except ServiceUnavailable:
            return False

    async def __aenter__(self) -> "Neo4jConnectionManager":
        await self.connect()
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()


# Module-level singleton accessor
neo4j_manager = Neo4jConnectionManager()