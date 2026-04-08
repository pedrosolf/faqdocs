const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Error desconocido')
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  health: () => req('GET', '/health'),
  listDocuments: () => req('GET', '/documents'),
  createDocument: (title, text) => req('POST', '/documents', { title, text }),
  deleteDocument: (id) => req('DELETE', `/documents/${id}`),
  chat: (message, sessionId, useRag, topK) =>
    req('POST', '/chat', { message, session_id: sessionId, use_rag: useRag, top_k: topK }),
}
