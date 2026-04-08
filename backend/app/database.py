"""Configuración de SQLAlchemy. Soporta SQLite (dev) y PostgreSQL (prod).

Para cambiar a Postgres basta con actualizar DATABASE_URL en .env:
    DATABASE_URL=postgresql://user:pass@host/dbname
"""
from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

# Crear directorio para SQLite si corresponde
if settings.database_url.startswith("sqlite:///"):
    raw_path = settings.database_url[len("sqlite:///"):]
    parent = os.path.dirname(os.path.abspath(raw_path))
    if parent:
        os.makedirs(parent, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Crea todas las tablas si no existen. Llamar al arrancar la app."""
    from . import models  # noqa: F401 — registra los modelos con Base
    Base.metadata.create_all(engine)
