import { useState, useEffect } from 'react'
import { api } from './api'
import DocumentsPanel from './components/DocumentsPanel'
import ChatPanel from './components/ChatPanel'

export default function App() {
  const [health, setHealth] = useState(null)
  const [backendError, setBackendError] = useState(false)
  const [documents, setDocuments] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)

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
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-2.5">
          {/* Botón hamburguesa — solo mobile */}
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors mr-1"
            onClick={() => setDrawerOpen(o => !o)}
            aria-label="Documentos"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </button>

          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs select-none">
            F
          </div>
          <span className="font-semibold text-gray-900 text-sm">FaqDocs</span>

          {/* Contador de docs — mobile */}
          {documents.length > 0 && (
            <span className="md:hidden text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
              {documents.length} doc{documents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          {backendError ? (
            <span className="flex items-center gap-1 text-red-500">
              <span className="w-2 h-2 bg-red-400 rounded-full inline-block" />
              Sin conexión
            </span>
          ) : health ? (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full inline-block" />
                <span className="hidden sm:inline">online</span>
              </span>
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600 hidden sm:inline">
                {health.model}
              </span>
              <span className="text-gray-400 hidden md:inline">
                {health.documents} doc{health.documents !== 1 ? 's' : ''} · {health.chunks} chunks
              </span>
            </>
          ) : (
            <span className="text-gray-400">conectando…</span>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Overlay — solo mobile cuando drawer está abierto */}
        {drawerOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-10"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Panel de documentos */}
        <div className={`
          fixed md:relative z-20 md:z-auto
          h-full md:h-auto
          w-72 flex-shrink-0
          transition-transform duration-300 ease-in-out
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <DocumentsPanel
            documents={documents}
            onRefresh={loadDocuments}
            onClose={() => setDrawerOpen(false)}
          />
        </div>

        {/* Chat — ocupa todo el ancho en mobile */}
        <ChatPanel hasDocuments={documents.length > 0} />
      </div>
    </div>
  )
}
