import { useState } from 'react'

export default function ChunksAccordion({ chunks }) {
  const [open, setOpen] = useState(false)
  if (!chunks || chunks.length === 0) return null

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={12} height={12}
          viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2.5}
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {open ? 'Ocultar' : 'Ver'} {chunks.length} fuente{chunks.length !== 1 ? 's' : ''}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {chunks.map((c, i) => (
            <div key={i} className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-indigo-600 mb-1 flex items-center justify-between">
                <span>{c.document_title}</span>
                <span className="font-normal text-indigo-400">
                  {(c.score * 100).toFixed(0)}% relevancia
                </span>
              </p>
              <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
