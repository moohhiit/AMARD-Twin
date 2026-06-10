"""
RailMind AI - Core Configuration Module.
Pydantic v2 Settings with environment variable validation.
"""

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    APP_NAME: str = Field(default="RailMind AI", description="Application name")
    APP_VERSION: str = Field(default="1.0.0", description="Application version")
    DEBUG: bool = Field(default=False, description="Debug mode")
    ENVIRONMENT: str = Field(default="production", description="Runtime environment")

    # Server
    HOST: str = Field(default="0.0.0.0", description="Server bind host")
    PORT: int = Field(default=8000, description="Server bind port")
    WORKERS: int = Field(default=1, description="Number of worker processes")

    # Neo4j Aura
    NEO4J_URI: str = Field(default="", description="Neo4j Aura connection URI")
    NEO4J_USERNAME: str = Field(default="", description="Neo4j Aura username")
    NEO4J_PASSWORD: str = Field(default="", description="Neo4j Aura password")
    NEO4J_MAX_CONNECTION_POOL_SIZE: int = Field(default=50, description="Max connection pool size")
    NEO4J_CONNECTION_TIMEOUT: float = Field(default=30.0, description="Connection timeout in seconds")

    # Event Bus
    EVENT_BUS_MAX_QUEUE_SIZE: int = Field(default=10000, description="Max event queue size")
    EVENT_BUS_WORKER_COUNT: int = Field(default=4, description="Number of event bus worker tasks")

    # WebSocket
    WS_HEARTBEAT_INTERVAL: float = Field(default=30.0, description="WebSocket heartbeat interval in seconds")
    WS_MAX_CONNECTIONS: int = Field(default=1000, description="Max concurrent WebSocket connections")

    # Logging
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    LOG_FORMAT: str = Field(default="json", description="Log format: json or console")

    # Security
    ALLOWED_ORIGINS: List[str] = Field(default_factory=lambda: ["*"], description="CORS allowed origins")
    API_KEY_HEADER: str = Field(default="X-API-Key", description="API key header name")

    # Digital Twin
    DIGITAL_TWIN_UPDATE_INTERVAL: float = Field(default=1.0, description="Digital twin state update interval in seconds")
    SIMULATION_SPEED_FACTOR: float = Field(default=1.0, description="Simulation speed multiplier")

    @property
    def neo4j_auth(self) -> tuple[str, str]:
        """Return Neo4j authentication tuple."""
        return (self.NEO4J_USERNAME, self.NEO4J_PASSWORD)


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()


settings = get_settings()