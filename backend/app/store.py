"""Store persistente sobre SQLAlchemy.

El estado ya no vive en memoria: documentos, chunks y sesiones se guardan
en la base de datos configurada en DATABASE_URL (SQLite por default, Postgres
en producción).

El índice TF-IDF sigue siendo in-memory (es un índice, no datos), y se
reconstruye automáticamente al arrancar y cada vez que se agregan/borran
documentos.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from . import models  # noqa: F401 — registra modelos con Base antes de create_all
from .database import SessionLocal, init_db
from .rag import chunk_text, retriever


# ---------- dataclasses de dominio (misma interfaz que antes) ----------------

@dataclass
class Chunk:
    document_id: str
    document_title: str
    text: str


@dataclass
class Document:
    id: str
    title: str
    n_chunks: int
    created_at: str


@dataclass
class ChatTurn:
    role: str  # "user" | "assistant"
    content: str


@dataclass
class ChatSession:
    id: str
    history: list[ChatTurn] = field(default_factory=list)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


# ---------- store --------------------------------------------------------------

class PersistentStore:
    def __init__(self) -> None:
        init_db()
        # Cache solo para el índice del retriever TF-IDF
        self._chunks_cache: list[Chunk] = []
        self._reindex()

    # ---- utilidades internas -------------------------------------------------

    def _reindex(self) -> None:
        """Recarga chunks desde la DB y reajusta el retriever."""
        with SessionLocal() as db:
            rows = db.query(models.ChunkModel).order_by(models.ChunkModel.id).all()
            self._chunks_cache = [
                Chunk(
                    document_id=r.document_id,
                    document_title=r.document_title,
                    text=r.text,
                )
                for r in rows
            ]
        retriever.fit([c.text for c in self._chunks_cache])

    # ---- documentos ----------------------------------------------------------

    def add_document(self, title: str, text: str) -> Document:
        chunk_texts = chunk_text(text)
        if not chunk_texts:
            raise ValueError("El texto está vacío después de procesarlo.")

        doc_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()

        with SessionLocal() as db:
            db.add(models.DocumentModel(
                id=doc_id,
                title=title,
                n_chunks=len(chunk_texts),
                created_at=now,
            ))
            for t in chunk_texts:
                db.add(models.ChunkModel(
                    document_id=doc_id,
                    document_title=title,
                    text=t,
                ))
            db.commit()

        self._reindex()
        return Document(id=doc_id, title=title, n_chunks=len(chunk_texts), created_at=now)

    def list_documents(self) -> list[Document]:
        with SessionLocal() as db:
            rows = db.query(models.DocumentModel).order_by(models.DocumentModel.created_at).all()
            return [
                Document(id=r.id, title=r.title, n_chunks=r.n_chunks, created_at=r.created_at)
                for r in rows
            ]

    def delete_document(self, doc_id: str) -> bool:
        with SessionLocal() as db:
            doc = db.get(models.DocumentModel, doc_id)
            if doc is None:
                return False
            db.delete(doc)
            db.commit()
        self._reindex()
        return True

    def search(self, query: str, k: int) -> list[tuple[Chunk, float]]:
        results = retriever.query(query, k)
        return [(self._chunks_cache[idx], score) for idx, score in results]

    # ---- contadores (para /health) ------------------------------------------

    def document_count(self) -> int:
        with SessionLocal() as db:
            return db.query(models.DocumentModel).count()

    def chunk_count(self) -> int:
        return len(self._chunks_cache)

    def session_count(self) -> int:
        with SessionLocal() as db:
            return db.query(models.ChatSessionModel).count()

    def has_chunks(self) -> bool:
        return len(self._chunks_cache) > 0

    # ---- sesiones ------------------------------------------------------------

    def get_or_create_session(self, session_id: str | None) -> ChatSession:
        with SessionLocal() as db:
            if session_id:
                row = db.get(models.ChatSessionModel, session_id)
                if row:
                    return ChatSession(
                        id=row.id,
                        history=[ChatTurn(role=t.role, content=t.content) for t in row.turns],
                        created_at=row.created_at,
                    )
            new_id = session_id or uuid.uuid4().hex[:12]
            now = datetime.now(timezone.utc).isoformat()
            db.add(models.ChatSessionModel(id=new_id, created_at=now))
            db.commit()
            return ChatSession(id=new_id, created_at=now)

    def append_turn(self, session_id: str, role: str, content: str) -> None:
        """Persiste un turno en la DB."""
        with SessionLocal() as db:
            db.add(models.ChatTurnModel(session_id=session_id, role=role, content=content))
            db.commit()

    def get_session(self, session_id: str) -> ChatSession | None:
        with SessionLocal() as db:
            row = db.get(models.ChatSessionModel, session_id)
            if row is None:
                return None
            return ChatSession(
                id=row.id,
                history=[ChatTurn(role=t.role, content=t.content) for t in row.turns],
                created_at=row.created_at,
            )

    def session_exists(self, session_id: str) -> bool:
        with SessionLocal() as db:
            return db.get(models.ChatSessionModel, session_id) is not None


store = PersistentStore()
