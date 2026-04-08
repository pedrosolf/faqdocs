"""Schemas Pydantic para request/response del API."""
from __future__ import annotations

from pydantic import BaseModel, Field


class DocumentIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    text: str = Field(..., min_length=1)


class DocumentOut(BaseModel):
    id: str
    title: str
    n_chunks: int
    created_at: str


class ChatIn(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str | None = None
    use_rag: bool = True
    top_k: int | None = Field(default=None, ge=1, le=20)


class RetrievedChunk(BaseModel):
    document_id: str
    document_title: str
    text: str
    score: float


class ChatOut(BaseModel):
    session_id: str
    reply: str
    used_rag: bool
    retrieved: list[RetrievedChunk] = []


class SessionMessage(BaseModel):
    role: str
    content: str


class SessionOut(BaseModel):
    id: str
    history: list[SessionMessage]
    created_at: str
