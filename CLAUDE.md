# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estructura del proyecto

```
askdocs-demo/
├── backend/          # FastAPI + SQLAlchemy + RAG
└── frontend/         # React + Vite + Tailwind
```

## Comandos de desarrollo

### Backend
```bash
cd backend

# Activar el entorno virtual (Windows)
../.venv/Scripts/activate   # o crear uno: python -m venv ../.venv

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Completar GROQ_API_KEY (o la del proveedor elegido) y DATABASE_URL

# Levantar el servidor con hot-reload (crea askdocs.db automáticamente)
uvicorn app.main:app --reload

# Correr tests (no requieren API key)
pytest
pytest tests/test_smoke.py::test_chunking_basico -v
```

### Frontend
```bash
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:8000
npm install
npm run dev               # dev server en :5173
npm run build             # build estático en dist/
```

## Arquitectura

### Backend

El flujo de `/chat` pasa por cuatro capas:

1. **`app/main.py`** — rutas FastAPI. Orquesta el flujo: valida input (Pydantic), retrieval, construye system prompt, llama al LLM, persiste el turno via `store.append_turn()`.
2. **`app/store.py`** — `PersistentStore` singleton (`store`). Persiste en DB todos los documentos, chunks y turnos de chat. Mantiene un cache en memoria (`_chunks_cache`) solo para el índice TF-IDF; `_reindex()` se llama al agregar/borrar documentos. Interface pública: `add_document`, `list_documents`, `delete_document`, `search`, `get_or_create_session`, `append_turn`, `get_session`, y contadores `document_count/chunk_count/session_count/has_chunks`.
3. **`app/rag.py`** — chunking y retrieval. `TfidfRetriever` expone `fit(texts)` y `query(text, k)` — interfaz pensada para swap trivial por embeddings densos.
4. **`app/llm.py`** — dispatcher `LLMClient` que delega a `AnthropicClient`, `DeepSeekClient` o `GroqClient` según `LLM_PROVIDER`. Todos usan lazy init. `build_rag_system_prompt()` inyecta chunks en el bloque `system`.

**`app/database.py`** — engine SQLAlchemy + `SessionLocal` + `Base`. `init_db()` crea las tablas si no existen; se llama en el constructor del store.

**`app/models.py`** — modelos ORM: `DocumentModel`, `ChunkModel`, `ChatSessionModel`, `ChatTurnModel`.

**`app/config.py`** — variables clave: `LLM_PROVIDER` (default: `"groq"`), `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL` (default: `sqlite:///./askdocs.db`).

### Frontend

- **`src/api.js`** — todas las llamadas al backend, base URL desde `VITE_API_URL`.
- **`src/App.jsx`** — layout raíz, llama a `/health` y gestiona lista de documentos.
- **`src/components/DocumentsPanel.jsx`** — upload (textarea o .txt), lista y borrado.
- **`src/components/ChatPanel.jsx`** — chat completo con toggle RAG, historial visual y nueva sesión.
- **`src/components/ChunksAccordion.jsx`** — fuentes expandibles bajo cada respuesta del asistente.

## Persistencia

- **SQLite** (default): se crea `backend/askdocs.db` al arrancar. No requiere configuración.
- **PostgreSQL** (producción): cambiar `DATABASE_URL=postgresql://user:pass@host/dbname` en `.env`.
- El índice TF-IDF se reconstruye desde la DB al arrancar el proceso — no se persiste.

## Consideraciones importantes

- **No hay autenticación**: CORS abierto con `allow_origins=["*"]`.
- El campo `retrieved` en `/chat` muestra los chunks usados — clave para debuggear el RAG.
- Al cambiar el retriever por embeddings, respetar la interfaz `fit(list[str])` / `query(str, int) -> list[tuple[int, float]]`.
- Los tests en `backend/tests/test_smoke.py` no requieren API key ni DB externa (usan SQLite en memoria via el fixture de FastAPI TestClient).
