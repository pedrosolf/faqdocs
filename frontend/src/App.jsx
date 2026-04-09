import { useState, useEffect, useRef } from 'react'
import { api } from './api'
import DocumentsPanel from './components/DocumentsPanel'
import ChatPanel from './components/ChatPanel'

// Estados del servidor
// 'checking'  — primer intento en curso
// 'waking'    — no respondió en 3s, reintentando cada 5s
// 'online'    — respondió OK
// 'error'     — falló de forma definitiva (no debería pasar con Render)

const FIRST_TIMEOUT = 3000   // si no responde en 3s → estado "waking"
const RETRY_INTERVAL = 5000  // reintentar cada 5s mientras duerme

export default function App() {
  const [serverStatus, setServerStatus] = useState('checking')
  const [health, setHealth] = useState(null)
  const [documents, setDocuments] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const retryTimer = useRef(null)

  useEffect(() => {
    pingServer()
    return () => clearTimeout(retryTimer.current)
  }, [])

  async function pingServer() {
    try {
      const h = await api.health(FIRST_TIMEOUT)
      onOnline(h)
    } catch {
      // No respondió en 3s — Render está durmiendo
      setServerStatus('waking')
      scheduleRetry()
    }
  }

  function scheduleRetry() {
    retryTimer.current = setTimeout(async () => {
      try {
        // Sin timeout en los reintentos — Render puede tardar hasta ~30s
        const h = await api.health()
        onOnline(h)
      } catch {
        scheduleRetry()
      }
    }, RETRY_INTERVAL)
  }

  function onOnline(h) {
    clearTimeout(retryTimer.current)
    setHealth(h)
    setServerStatus('online')
    loadDocuments()
  }

  async function loadDocuments() {
    try {
      setDocuments(await api.listDocuments())
    } catch {}
  }

  const isWaking = serverStatus === 'checking' || serverStatus === 'waking'

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-2.5">
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

          {documents.length > 0 && (
            <span className="md:hidden text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
              {documents.length} doc{documents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          {serverStatus === 'checking' && (
            <span className="flex items-center gap-1.5 text-gray-400">
              <SpinnerIcon size={12} />
              conectando…
            </span>
          )}
          {serverStatus === 'waking' && (
            <span className="flex items-center gap-1.5 text-amber-500">
              <SpinnerIcon size={12} className="text-amber-500" />
              despertando servidor…
            </span>
          )}
          {serverStatus === 'online' && (
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
          )}
        </div>
      </header>

      {/* Banner de wake-up — se muestra solo mientras el servidor duerme */}
      {isWaking && <WakingBanner slow={serverStatus === 'waking'} />}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {drawerOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-10"
            onClick={() => setDrawerOpen(false)}
          />
        )}

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

        <ChatPanel hasDocuments={documents.length > 0} serverReady={serverStatus === 'online'} />
      </div>
    </div>
  )
}

function WakingBanner({ slow }) {
  return (
    <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-2.5 text-sm
      ${slow
        ? 'bg-amber-50 border-b border-amber-200 text-amber-800'
        : 'bg-indigo-50 border-b border-indigo-100 text-indigo-700'
      }`}
    >
      <SpinnerIcon size={15} />
      <span>
        {slow
          ? <>El servidor está <strong>despertando</strong> (puede tardar hasta 30 segundos en el plan gratuito). El chat se habilitará automáticamente.</>
          : 'Conectando con el servidor…'
        }
      </span>
    </div>
  )
}

function SpinnerIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5}
      className={`animate-spin flex-shrink-0 ${className}`}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  )
}
