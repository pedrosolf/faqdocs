import { useState, useRef } from 'react'
import { api } from '../api'

export default function DocumentsPanel({ documents, onRefresh, onClose }) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const fileRef = useRef()

  async function handleUpload(e) {
    e.preventDefault()
    if (!title.trim() || !text.trim()) return
    setUploading(true)
    setError('')
    try {
      await api.createDocument(title.trim(), text.trim())
      setTitle('')
      setText('')
      await onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''))
    const reader = new FileReader()
    reader.onload = ev => setText(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleDelete(id) {
    setDeletingId(id)
    try {
      await api.deleteDocument(id)
      await onRefresh()
    } catch {}
    setDeletingId(null)
  }

  return (
    <aside className="w-72 h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* Cabecera del panel con botón cerrar en mobile */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Documentos
          </h2>
          <button
            className="md:hidden p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={onClose}
            aria-label="Cerrar panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-2">
          <input
            type="text"
            placeholder="Título"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400"
          />
          <textarea
            placeholder="Pegá el texto del documento…"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={5}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400 resize-none"
          />

          {error && (
            <p className="text-xs text-red-500 leading-snug">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current.click()}
              className="flex-shrink-0 text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-2 hover:bg-indigo-50 transition-colors"
            >
              .txt
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="submit"
              disabled={uploading || !title.trim() || !text.trim()}
              className="flex-1 text-sm bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {uploading ? 'Subiendo…' : 'Subir'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-4">
            Sin documentos todavía
          </p>
        ) : (
          documents.map(doc => (
            <div
              key={doc.id}
              className="group flex items-start justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2.5 hover:bg-indigo-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {doc.n_chunks} chunk{doc.n_chunks !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={deletingId === doc.id}
                className="flex-shrink-0 text-gray-300 hover:text-red-400 disabled:opacity-40 transition-colors mt-0.5"
                title="Eliminar"
              >
                {deletingId === doc.id ? <Spinner size={14} /> : <TrashIcon />}
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function Spinner({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  )
}
