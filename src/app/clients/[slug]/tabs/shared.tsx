'use client'

import { useState } from 'react'

/* ── Data Table ─────────────────────────────────── */
export function DataTable({ columns, data, pageSize = 50, emptyMessage = 'No data available' }: { columns: { key: string; label: string; format?: (v: any, row?: any) => string | React.ReactNode; align?: string }[]; data: any[]; pageSize?: number; emptyMessage?: string }) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(data.length / pageSize)
  const pageData = data.slice(page * pageSize, (page + 1) * pageSize)

  return (
    <div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#e8e8ec]">
              {columns.map(col => (
                <th key={col.key} className={`py-3 px-4 text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 && (
              <tr><td colSpan={columns.length} className="py-12 text-center text-[#9d9da8] text-[13px]">{emptyMessage}</td></tr>
            )}
            {pageData.map((row, i) => (
              <tr key={i} className={`border-b border-[#f4f4f6] hover:bg-[#f0f4ff] transition-colors ${row._highlight ? 'bg-[#fffbeb]' : i % 2 === 1 ? 'bg-[#fafafb]' : ''}`}>
                {columns.map(col => (
                  <td key={col.key} className={`py-2.5 px-4 tabular-nums ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
                    {col.format ? col.format(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#e8e8ec]">
          <span className="text-[11px] text-[#9d9da8]">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} of {data.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-2.5 py-1 text-[11px] font-medium rounded-md disabled:opacity-30 text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors">Prev</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i : page < 3 ? i : page > totalPages - 3 ? totalPages - 5 + i : page - 2 + i
              return (
                <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-[11px] font-medium rounded-md transition-colors ${page === p ? 'bg-[#111113] text-white' : 'text-[#6b6b76] hover:bg-[#f4f4f6]'}`}>{p + 1}</button>
              )
            })}
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} className="px-2.5 py-1 text-[11px] font-medium rounded-md disabled:opacity-30 text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Ad Image ───────────────────────────────────── */
export function AdImage({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const [error, setError] = useState(false)
  if (!src || error) {
    return (
      <div className={`bg-gradient-to-br from-[#f4f4f6] to-[#e8e8ec] flex flex-col items-center justify-center text-[#c4c4cc] gap-1 ${className}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
        </svg>
        <span className="text-[9px] font-medium">No preview</span>
      </div>
    )
  }
  return <img src={src} alt={alt} className={`object-cover ${className}`} onError={() => setError(true)} loading="lazy" />
}
