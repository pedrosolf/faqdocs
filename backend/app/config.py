"""Configuración de la app, cargada desde variables de entorno o .env."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Proveedor activo: "anthropic" | "deepseek" | "groq"
    llm_provider: str = "groq"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # DeepSeek
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com/v1"

    # Groq
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # RAG / retriever
    chunk_size: int = 500
    chunk_overlap: int = 50
    top_k: int = 4

    # Chat
    max_history_turns: int = 6

    # Base de datos
    database_url: str = "sqlite:///./askdocs.db"


settings = Settings()
