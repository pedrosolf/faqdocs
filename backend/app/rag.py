"""Chunking de documentos y retriever simple basado en TF-IDF.

Decisión técnica: usamos TF-IDF en vez de embeddings densos (sentence-transformers,
OpenAI embeddings, etc.) para que la demo arranque en segundos sin descargar
modelos pesados ni depender de una segunda API. En producción la sustitución
natural sería un encoder de sentence-transformers o un servicio de embeddings
(OpenAI, Voyage, Cohere) y una base vectorial real (pgvector, Qdrant, Pinecone).
La interfaz `Retriever.fit/query` está pensada para que ese swap sea trivial.
"""
from __future__ import annotations

import re

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .config import settings


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> list[str]:
    """Parte un texto en chunks de aproximadamente `chunk_size` caracteres.

    Estrategia: primero divide por párrafos (líneas en blanco) y empaqueta
    párrafos consecutivos hasta llenar el chunk. Si un párrafo solo es más
    grande que `chunk_size`, lo corta en ventanas con solapamiento `overlap`
    para no perder contexto en los bordes.
    """
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]

    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        candidate = f"{current}\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= chunk_size:
            current = candidate
            continue

        if current:
            chunks.append(current)
            current = ""

        if len(paragraph) > chunk_size:
            # párrafo demasiado largo: ventana deslizante con solapamiento
            start = 0
            while start < len(paragraph):
                end = min(start + chunk_size, len(paragraph))
                chunks.append(paragraph[start:end])
                if end == len(paragraph):
                    break
                start = end - overlap
        else:
            current = paragraph

    if current:
        chunks.append(current)

    return chunks


class TfidfRetriever:
    """Retriever en memoria basado en TF-IDF + cosine similarity."""

    def __init__(self) -> None:
        self._vectorizer: TfidfVectorizer | None = None
        self._matrix = None

    def fit(self, texts: list[str]) -> None:
        if not texts:
            self._vectorizer = None
            self._matrix = None
            return
        self._vectorizer = TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2),
            min_df=1,
            strip_accents="unicode",
        )
        self._matrix = self._vectorizer.fit_transform(texts)

    def query(self, text: str, k: int) -> list[tuple[int, float]]:
        if self._vectorizer is None or self._matrix is None or self._matrix.shape[0] == 0:
            return []
        q_vec = self._vectorizer.transform([text])
        scores = cosine_similarity(q_vec, self._matrix)[0]
        k = min(k, len(scores))
        if k <= 0:
            return []
        top_idx = np.argpartition(-scores, k - 1)[:k]
        top_idx = top_idx[np.argsort(-scores[top_idx])]
        return [(int(i), float(scores[i])) for i in top_idx if scores[i] > 0]


# Singleton del retriever (un único índice in-memory para toda la app)
retriever = TfidfRetriever()
