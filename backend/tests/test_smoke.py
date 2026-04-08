"""Smoke tests que NO requieren API key.

Validan la lógica pura (chunking, retriever) y que el endpoint /health
responde sin tocar Anthropic.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.rag import TfidfRetriever, chunk_text


def test_chunking_basico():
    text = "Párrafo uno corto.\n\nPárrafo dos también corto."
    chunks = chunk_text(text, chunk_size=200, overlap=20)
    assert len(chunks) >= 1
    assert all(c.strip() for c in chunks)


def test_chunking_split_largo():
    text = "x" * 1500
    chunks = chunk_text(text, chunk_size=500, overlap=50)
    assert len(chunks) >= 3
    assert all(len(c) <= 500 for c in chunks)


def test_retriever_devuelve_el_mas_relevante():
    r = TfidfRetriever()
    r.fit(
        [
            "El perro come croquetas todas las mañanas.",
            "Los gatos prefieren atún en lata.",
            "El envío en Corrientes capital es gratis para compras grandes.",
        ]
    )
    results = r.query("¿hacen envíos en Corrientes?", k=2)
    assert len(results) >= 1
    assert results[0][0] == 2  # el chunk de envíos debería ganar


def test_retriever_vacio():
    r = TfidfRetriever()
    r.fit([])
    assert r.query("cualquier cosa", k=3) == []


def test_health_endpoint():
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "model" in body


def test_crear_y_listar_documento():
    client = TestClient(app)
    payload = {"title": "Test doc", "text": "Hola mundo.\n\nSegundo párrafo de prueba."}
    r = client.post("/documents", json=payload)
    assert r.status_code == 201
    doc = r.json()
    assert doc["title"] == "Test doc"
    assert doc["n_chunks"] >= 1

    r2 = client.get("/documents")
    assert r2.status_code == 200
    assert any(d["id"] == doc["id"] for d in r2.json())

    # cleanup
    client.delete(f"/documents/{doc['id']}")
