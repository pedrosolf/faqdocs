# AskDocs Demo

> Mini API en **FastAPI** que demuestra integración con LLMs (**Anthropic Claude**) y un flujo **RAG** (Retrieval-Augmented Generation) simple sobre documentos en memoria.

Proyecto pensado como **demo técnica de portfolio**: chico, leíble en una sentada, con decisiones explicadas y un camino claro hacia producción.

---

## ¿Qué hace?

1. Permite **subir documentos** (texto plano) por API.
2. Los **chunkea** y los indexa en un retriever en memoria.
3. Expone un endpoint de **chat** que, dada una pregunta del usuario:
   - recupera los chunks más relevantes,
   - los inyecta como contexto en un *system prompt*,
   - llama a Claude vía la API oficial de Anthropic,
   - mantiene el historial de conversación por sesión.

Es el patrón base de cualquier asistente "respondé sobre estos documentos": atención al cliente, FAQs, manuales internos, knowledge bases, etc.

---

## Arquitectura

```
                ┌────────────────────────────────────────────┐
                │                FastAPI app                 │
  POST /chat ──▶│                                            │
                │  ┌─────────┐   ┌──────────┐   ┌─────────┐  │
                │  │ Schemas │   │  Store   │   │   LLM   │  │
                │  │ Pydantic│   │ in-mem   │   │ wrapper │  │
                │  └─────────┘   └────┬─────┘   └────┬────┘  │
                │                     │              │       │
                │                ┌────▼─────┐        │       │
                │                │ Retriever│        │       │
                │                │  TF-IDF  │        │       │
                │                └──────────┘        │       │
                └──────────────────────────────────┬─┴───────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │  Anthropic API  │
                                          │  (claude-haiku) │
                                          └─────────────────┘
```

**Flujo de una llamada a `/chat`:**

1. Pydantic valida el payload (`message`, `session_id`, `use_rag`).
2. El `Store` recupera o crea la sesión.
3. Si `use_rag=true`, el `Retriever` devuelve los top-k chunks más relevantes a la pregunta.
4. Se arma un *system prompt* que inyecta esos chunks como contexto.
5. Se llama al modelo con el historial recortado a las últimas N vueltas.
6. La respuesta se persiste en la sesión y se devuelve al cliente junto con los chunks usados (para trazabilidad).

---

## Stack

- **Python 3.10+**
- **FastAPI** + **Uvicorn** — API y servidor ASGI.
- **Pydantic v2** + **pydantic-settings** — validación y carga de configuración.
- **Anthropic Python SDK** — cliente oficial para llamar a Claude.
- **scikit-learn** — `TfidfVectorizer` para el retriever.
- **NumPy** — operaciones vectoriales.
- **pytest** + **httpx** — tests.

---

## Cómo correrlo

```bash
# 1. clonar y entrar
git clone <tu-repo>
cd askdocs-demo

# 2. crear venv
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate

# 3. instalar dependencias
pip install -r requirements.txt

# 4. configurar la API key
cp .env.example .env
# editá .env y poné tu ANTHROPIC_API_KEY

# 5. levantar el server
uvicorn app.main:app --reload

# 6. abrir la doc interactiva
# http://127.0.0.1:8000/docs
```

> La doc interactiva (Swagger UI) la genera FastAPI sola en `/docs`. Desde ahí podés probar todos los endpoints sin escribir una sola línea de código.

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Healthcheck. No requiere API key. |
| `POST` | `/documents` | Sube un documento, lo chunkea e indexa. |
| `GET` | `/documents` | Lista los documentos indexados. |
| `DELETE` | `/documents/{id}` | Borra un documento y reindexa. |
| `POST` | `/chat` | Pregunta al asistente. Mantiene historial por `session_id`. |
| `GET` | `/sessions/{id}` | Devuelve el historial completo de una sesión. |

---

## Demo en 2 minutos

```bash
# 1. subir el documento de ejemplo (FAQ ficticia de pet food)
curl -X POST http://127.0.0.1:8000/documents \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"FAQ Butter\", \"text\": $(cat sample_docs/faq_butter.txt | python -c 'import sys, json; print(json.dumps(sys.stdin.read()))')}"

# 2. preguntar algo que esté en la FAQ
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "¿hacen envíos gratis en Corrientes?", "use_rag": true}'

# 3. preguntar algo que NO esté → el asistente debería decir que no lo encuentra
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "¿venden comida para iguanas?", "use_rag": true}'
```

La respuesta de `/chat` incluye un campo `retrieved` con los chunks que efectivamente se usaron para generar la respuesta — esto es clave para **debuggear** y **auditar** el comportamiento del asistente, no es solo cosmético.

---

## Decisiones técnicas (lo que me preguntarían en una entrevista)

### ¿Por qué TF-IDF y no embeddings densos?

Para una demo que tiene que arrancar en segundos sin descargar modelos pesados ni depender de una segunda API, TF-IDF es honesto: cero dependencias extras, funciona de inmediato, y para un FAQ de pocas decenas de párrafos da resultados decentes.

**Limitaciones reales** (las menciono porque sé que existen):
- No captura sinónimos ni similitud semántica ("envío" vs "entrega" vs "delivery").
- No funciona bien cross-lingual.
- Escala mal a corpus muy grandes sin un índice invertido pensado para eso.

**Cómo lo cambiaría en producción:** la interfaz `Retriever.fit/query` está hecha para hacer el swap trivial. Reemplazaría por:
- **Embeddings:** `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (local, gratis) o un servicio (OpenAI, Voyage, Cohere) según costo/calidad.
- **Storage vectorial:** **pgvector** sobre la Postgres existente del cliente (mi default si ya hay Postgres), o **Qdrant**/**Pinecone** si el caso lo justifica.
- **Reranking:** segundo paso con un cross-encoder o con el propio LLM para mejorar precisión en el top-k.

### ¿Por qué chunking simple por párrafos y no algo más sofisticado?

El chunker actual divide por párrafos y empaqueta hasta llegar a `chunk_size`, con ventana deslizante para párrafos largos. Es simple pero respeta la unidad lógica del texto, que para FAQs y documentos estructurados suele ser lo que querés.

Para documentos más complejos (PDFs con tablas, código, markdown anidado) usaría un splitter consciente de estructura — por ejemplo, dividir por headings de Markdown, tratar bloques de código como atómicos, etc. La regla que sigo: **chunkear lo más grande posible sin romper la unidad semántica**, porque cada chunk extra es ruido potencial en el contexto.

### ¿Por qué inyectar el contexto en el system prompt y no en el user message?

Dos razones:
1. **Claridad para el modelo:** dejar instrucción y datos en el system mantiene el `user` limpio (solo la pregunta real), lo que se parece más a cómo el modelo fue entrenado.
2. **Cache de prompts:** Anthropic soporta *prompt caching* sobre el bloque system, así que en una conversación larga con el mismo contexto se ahorran tokens. (No lo activé en la demo para no agregar complejidad, pero está a una flag de distancia.)

### ¿Por qué historial recortado y no infinito?

Cada turno previo gasta tokens de contexto y plata. La estrategia "últimas N vueltas" es la más barata y, para un asistente de FAQ, suficiente. Para casos más sofisticados haría:
- **Sliding window** + **resumen** de la conversación vieja (le pido al propio LLM que resuma cada X turnos).
- O un store vectorial sobre los mensajes históricos para recuperar solo los relevantes.

### ¿Por qué store en memoria?

Porque es una demo. En producción cualquier reinicio del proceso pierde todo, dos workers de Uvicorn no comparten estado, y no hay forma de escalar horizontalmente. La sustitución es directa:
- **Documentos + chunks:** Postgres con `pgvector`.
- **Sesiones de chat:** Redis (TTL natural) o Postgres si necesito auditar.
- **Multitenancy:** una columna `tenant_id` en todas las tablas y filtros forzados a nivel ORM.

### ¿Por qué FastAPI y no Flask o Django?

Para este caso de uso: tipado fuerte vía Pydantic (validación automática), async nativo (importante cuando esperás respuesta de un LLM externo), docs OpenAPI generadas solas, y sintaxis liviana. Django sería overkill y Flask requeriría montar a mano cosas que FastAPI te da gratis.

---

## Roadmap a producción

Cosas que dejé afuera **a propósito** para mantener el alcance, en orden de prioridad:

- [ ] **Embeddings reales + pgvector** (swap del retriever).
- [ ] **Streaming de respuestas** del LLM hacia el cliente (SSE) para que el usuario vea la respuesta a medida que se genera.
- [ ] **Autenticación** (API keys por cliente o JWT) y **rate limiting**.
- [ ] **Persistencia** (Postgres + Alembic para migraciones).
- [ ] **Observabilidad:** logging estructurado, tracing de cada llamada al LLM con tokens consumidos y latencia, métricas Prometheus.
- [ ] **Guardrails:** detección de prompt injection, filtros de contenido sensible, validación de que la respuesta efectivamente se basa en el contexto.
- [ ] **Evaluación offline:** un set de preguntas con respuestas esperadas para detectar regresiones cuando se cambian prompts o el modelo.
- [ ] **Soporte multi-formato:** ingestión de PDF, DOCX, HTML (con `unstructured` o similar).
- [ ] **Dockerfile** + **docker-compose** con Postgres para desarrollo local realista.
- [ ] **CI** con GitHub Actions: lint, type-check, tests.

---

## Tests

```bash
pytest
```

Los tests que están NO requieren API key — validan chunking, retriever y endpoints que no llaman a Anthropic. Son smoke tests rápidos para CI.

Para tests de integración reales contra Anthropic, usaría una key de test y los marcaría con `@pytest.mark.integration` para ejecutarlos sólo en demanda.

---

## Estructura del proyecto

```
askdocs-demo/
├── README.md
├── requirements.txt
├── .env.example
├── .gitignore
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app y rutas
│   ├── config.py        # settings (pydantic-settings)
│   ├── schemas.py       # modelos Pydantic de I/O
│   ├── llm.py           # wrapper de Anthropic + system prompts
│   ├── rag.py           # chunking + retriever TF-IDF
│   └── store.py         # store en memoria de docs y sesiones
├── sample_docs/
│   └── faq_butter.txt   # documento de ejemplo
└── tests/
    ├── __init__.py
    └── test_smoke.py
```

---

## Licencia

MIT.
