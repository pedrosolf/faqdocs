import { useState, useEffect } from 'react'
import { api } from './api'
import DocumentsPanel from './components/DocumentsPanel'
import ChatPanel from './components/ChatPanel'

export default function App() {
  const [health, setHealth] = useState(null)
  const [backendError, setBackendError] = useState(false)
  const [documents, setDocuments] = useState([])

  useEffect(() => {
    api.health()
      .then(h => { setHealth(h); setBackendError(false) })
      .catch(() => setBackendError(true))
    loadDocuments()
  }, [])

  async function loadDocuments() {
    try {
      setDocuments(await api.listDocuments())
    } catch {}
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm select-none">
            A
          </div>
          <span className="font-semibold text-gray-900 text-sm">FaqDocs</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          {backendError ? (
            <span className="flex items-center gap-1 text-red-500">
              <span className="w-2 h-2 bg-red-400 rounded-full" />
              Backend no disponible
            </span>
          ) : health ? (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                online
              </span>
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                {health.model}
              </span>
              <span className="text-gray-400">
                {health.documents} doc{health.documents !== 1 ? 's' : ''} · {health.chunks} chunks
              </span>
            </>
          ) : (
            <span className="text-gray-400">conectando…</span>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <DocumentsPanel
          documents={documents}
          onRefresh={loadDocuments}
        />
        <ChatPanel hasDocuments={documents.length > 0} />
      </div>
    </div>
  )
}
