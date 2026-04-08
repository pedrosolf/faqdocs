"""FastAPI app — punto de entrada del servidor."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .llm import SYSTEM_PROMPT_BASE, build_rag_system_prompt, llm
from .schemas import (
    ChatIn,
    ChatOut,
    DocumentIn,
    DocumentOut,
    RetrievedChunk,
    SessionMessage,
    SessionOut,
)
from .store import store

app = FastAPI(
    title="AskDocs Demo",
    description=(
        "Mini API en FastAPI que demuestra integración con LLMs (Anthropic / Groq / DeepSeek) "
        "y un flujo RAG simple sobre documentos persistidos en base de datos. "
        "Pensada como demo técnica, no para producción."
    ),
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- health ----------------------------------------------------------


@app.get("/health")
def health() -> dict:
    active_model = (
        settings.anthropic_model if settings.llm_provider == "anthropic"
        else settings.groq_model if settings.llm_provider == "groq"
        else settings.deepseek_model
    )
    return {
        "status": "ok",
        "model": active_model,
        "provider": settings.llm_provider,
        "documents": store.document_count(),
        "chunks": store.chunk_count(),
        "sessions": store.session_count(),
    }


# ---------- documentos ------------------------------------------------------


@app.post("/documents", response_model=DocumentOut, status_code=201)
def create_document(payload: DocumentIn) -> DocumentOut:
    try:
        doc = store.add_document(title=payload.title, text=payload.text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return DocumentOut(**doc.__dict__)


@app.get("/documents", response_model=list[DocumentOut])
def list_documents() -> list[DocumentOut]:
    return [DocumentOut(**d.__dict__) for d in store.list_documents()]


@app.delete("/documents/{doc_id}", status_code=204)
def delete_document(doc_id: str) -> None:
    if not store.delete_document(doc_id):
        raise HTTPException(status_code=404, detail="Documento no encontrado.")


# ---------- chat ------------------------------------------------------------


@app.post("/chat", response_model=ChatOut)
def chat(payload: ChatIn) -> ChatOut:
    session = store.get_or_create_session(payload.session_id)

    # 1. retrieval (si corresponde)
    retrieved: list[RetrievedChunk] = []
    if payload.use_rag and store.has_chunks():
        top_k = payload.top_k or settings.top_k
        for chunk, score in store.search(payload.message, top_k):
            retrieved.append(
                RetrievedChunk(
                    document_id=chunk.document_id,
                    document_title=chunk.document_title,
                    text=chunk.text,
                    score=score,
                )
            )

    # 2. armado del system prompt
    if payload.use_rag and retrieved:
        system_prompt = build_rag_system_prompt(
            [(r.document_title, r.text) for r in retrieved]
        )
    else:
        system_prompt = SYSTEM_PROMPT_BASE

    # 3. historial recortado para controlar tokens
    max_msgs = settings.max_history_turns * 2
    history_msgs = [
        {"role": t.role, "content": t.content}
        for t in session.history[-max_msgs:]
    ]
    history_msgs.append({"role": "user", "content": payload.message})

    # 4. llamada al modelo
    try:
        reply = llm.chat(messages=history_msgs, system_prompt=system_prompt)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Error llamando al modelo: {e}")

    # 5. persistir turnos en la DB
    store.append_turn(session.id, "user", payload.message)
    store.append_turn(session.id, "assistant", reply)

    return ChatOut(
        session_id=session.id,
        reply=reply,
        used_rag=bool(payload.use_rag and retrieved),
        retrieved=retrieved,
    )


@app.get("/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: str) -> SessionOut:
    s = store.get_session(session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    return SessionOut(
        id=s.id,
        history=[SessionMessage(role=t.role, content=t.content) for t in s.history],
        created_at=s.created_at,
    )
