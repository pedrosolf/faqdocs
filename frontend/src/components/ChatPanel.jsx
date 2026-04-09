import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import ChunksAccordion from './ChunksAccordion'

export default function ChatPanel({ hasDocuments, serverReady = true }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [useRag, setUseRag] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Foco al montar
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function send() {
    const text = input.trim()
    if (!text || loading || !serverReady) return

    // Limpiar input y poner foco ANTES de la llamada async
    setInput('')
    inputRef.current?.focus()

    setMessages(m => [...m, { id: Date.now(), role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await api.chat(text, sessionId, useRag && hasDocuments)
      setSessionId(res.session_id)
      setMessages(m => [...m, {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.reply,
        retrieved: res.retrieved,
        usedRag: res.used_rag,
      }])
    } catch (err) {
      setMessages(m => [...m, {
        id: Date.now() + 1,
        role: 'error',
        content: err.message,
      }])
    } finally {
      setLoading(false)
      // Re-foco por si el browser lo perdió durante la respuesta
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function clearSession() {
    setMessages([])
    setSessionId(null)
    inputRef.current?.focus()
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 min-w-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => setUseRag(r => !r)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              useRag && hasDocuments ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                useRag && hasDocuments ? 'translate-x-4' : ''
              }`}
            />
          </div>
          <span className="text-xs text-gray-600">
            RAG
            {!hasDocuments && <span className="text-gray-400 ml-1">(sin docs)</span>}
          </span>
        </label>

        <div className="flex items-center gap-3">
          {sessionId && (
            <span className="text-xs text-gray-400 font-mono hidden sm:block truncate max-w-[140px]">
              sesión: {sessionId}
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearSession}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
            >
              Nueva sesión
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scroll px-3 sm:px-5 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-3 pb-16 px-4">
            <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 max-w-xs">
              {hasDocuments
                ? 'Hacé una pregunta sobre tus documentos'
                : 'Abrí el panel de documentos y subí uno para empezar'}
            </p>
          </div>
        )}

        {messages.map(msg => (
          <Message key={msg.id} msg={msg} />
        ))}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 sm:px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={serverReady ? 'Escribí tu pregunta… (Enter para enviar)' : 'Esperando que el servidor despierte…'}
            rows={1}
            className={`flex-1 text-sm border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400 resize-none bg-white max-h-32 overflow-y-auto transition-colors ${serverReady ? 'border-gray-200' : 'border-amber-200 bg-amber-50/50'}`}
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim() || !serverReady}
            className="flex-shrink-0 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors"
          >
            {loading ? <Spinner /> : <SendIcon />}
          </button>
        </div>
      </div>
    </main>
  )
}

function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%] bg-indigo-600 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 leading-relaxed">
          {msg.content}
        </div>
      </div>
    )
  }

  if (msg.role === 'error') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] sm:max-w-[75%] bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl rounded-bl-sm px-4 py-2.5 leading-relaxed">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start gap-2">
      <div className="flex-shrink-0 w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center mt-0.5">
        <span className="text-indigo-600 text-xs font-bold">A</span>
      </div>
      <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
        <div className="bg-white border border-gray-200 text-gray-800 text-sm rounded-2xl rounded-bl-sm px-4 py-2.5 leading-relaxed shadow-sm whitespace-pre-wrap break-words">
          {msg.content}
        </div>
        <ChunksAccordion chunks={msg.retrieved} />
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start gap-2">
      <div className="flex-shrink-0 w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
        <span className="text-indigo-600 text-xs font-bold">A</span>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity={0.3} />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  )
}
