"""Wrapper sobre los clientes LLM soportados: Anthropic, DeepSeek y Groq.

El proveedor activo se controla con la variable de entorno LLM_PROVIDER
("anthropic" | "deepseek" | "groq"). El cliente se instancia de forma lazy la
primera vez que se usa, así el servidor puede levantarse sin claves cargadas
(útil para /health, tests y CI).
"""
from __future__ import annotations

import httpx
from anthropic import Anthropic

from .config import settings


SYSTEM_PROMPT_BASE = (
    "Sos un asistente útil, claro y conciso. "
    "Respondés en el mismo idioma en el que te escribe el usuario. "
    "Si no sabés algo, lo decís sin inventar."
)

SYSTEM_PROMPT_RAG_SUFFIX = (
    "\n\nUsá EXCLUSIVAMENTE la información del CONTEXTO para responder. "
    "Si la respuesta no está en el contexto, decí honestamente que no la "
    "encontrás en los documentos disponibles. Cuando sea posible, citá el "
    "título del documento entre paréntesis al final de la frase relevante."
)


def build_rag_system_prompt(context_blocks: list[tuple[str, str]]) -> str:
    """Construye el system prompt inyectando los chunks recuperados.

    `context_blocks` es una lista de tuplas (titulo_documento, texto_chunk).
    """
    if not context_blocks:
        return SYSTEM_PROMPT_BASE + "\n\n(No hay documentos indexados todavía.)"

    formatted = "\n\n".join(
        f"[{i + 1}] Documento: {title}\n{text}"
        for i, (title, text) in enumerate(context_blocks)
    )
    return (
        SYSTEM_PROMPT_BASE
        + SYSTEM_PROMPT_RAG_SUFFIX
        + f"\n\n=== CONTEXTO ===\n{formatted}\n=== FIN CONTEXTO ==="
    )


class AnthropicClient:
    """Cliente para la API de Anthropic (Claude)."""

    def __init__(self) -> None:
        self._client: Anthropic | None = None

    def _get(self) -> Anthropic:
        if self._client is None:
            if not settings.anthropic_api_key:
                raise RuntimeError(
                    "ANTHROPIC_API_KEY no está configurada. "
                    "Copiá .env.example a .env y completá la clave."
                )
            self._client = Anthropic(api_key=settings.anthropic_api_key)
        return self._client

    def chat(
        self,
        messages: list[dict],
        system_prompt: str,
        max_tokens: int = 1024,
    ) -> str:
        client = self._get()
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages,
        )
        parts = [
            block.text
            for block in response.content
            if getattr(block, "type", None) == "text"
        ]
        return "".join(parts).strip()


class DeepSeekClient:
    """Cliente para la API de DeepSeek (compatible con OpenAI).

    Usa httpx directamente para evitar una dependencia extra; el endpoint
    sigue el mismo formato que la API de OpenAI.
    """

    def chat(
        self,
        messages: list[dict],
        system_prompt: str,
        max_tokens: int = 1024,
    ) -> str:
        if not settings.deepseek_api_key:
            raise RuntimeError(
                "DEEPSEEK_API_KEY no está configurada. "
                "Copiá .env.example a .env y completá la clave."
            )
        payload = {
            "model": settings.deepseek_model,
            "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
        }
        response = httpx.post(
            f"{settings.deepseek_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.deepseek_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()


class GroqClient:
    """Cliente para la API de Groq (compatible con OpenAI)."""

    def chat(
        self,
        messages: list[dict],
        system_prompt: str,
        max_tokens: int = 1024,
    ) -> str:
        if not settings.groq_api_key:
            raise RuntimeError(
                "GROQ_API_KEY no está configurada. "
                "Copiá .env.example a .env y completá la clave."
            )
        payload = {
            "model": settings.groq_model,
            "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
        }
        response = httpx.post(
            f"{settings.groq_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()


class LLMClient:
    """Dispatcher que delega al proveedor configurado en LLM_PROVIDER."""

    def __init__(self) -> None:
        self._anthropic = AnthropicClient()
        self._deepseek = DeepSeekClient()
        self._groq = GroqClient()

    def _backend(self) -> AnthropicClient | DeepSeekClient | GroqClient:
        provider = settings.llm_provider.lower()
        if provider == "anthropic":
            return self._anthropic
        if provider == "deepseek":
            return self._deepseek
        if provider == "groq":
            return self._groq
        raise RuntimeError(
            f"LLM_PROVIDER desconocido: '{provider}'. "
            "Valores válidos: 'anthropic', 'deepseek', 'groq'."
        )

    def chat(
        self,
        messages: list[dict],
        system_prompt: str,
        max_tokens: int = 1024,
    ) -> str:
        return self._backend().chat(
            messages=messages,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
        )


llm = LLMClient()
