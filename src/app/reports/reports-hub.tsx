'use client'

import { useState, useCallback, useEffect } from 'react'

interface Client {
  id: string
  name: string
  slug: string
  industry: string | null
}

interface Report {
  id: string
  client_id: string
  client_name: string
  week: string
  period_start: string
  period_end: string
  subject: string | null
  content: string | null
  status: 'pending' | 'draft' | 'reviewed' | 'sent'
  generated_at: string | null
  reviewed_at: string | null
  sent_at: string | null
  notes: string | null
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#9d9da8', bg: '#f4f4f6' },
  draft: { label: 'Draft', color: '#2563eb', bg: '#dbeafe' },
  reviewed: { label: 'Reviewed', color: '#f59e0b', bg: '#fef3c7' },
  sent: { label: 'Sent', color: '#16a34a', bg: '#dcfce7' },
} as const

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider" style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtFull(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const PERIODS = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '60d', value: 60 },
  { label: '90d', value: 90 },
]

function markdownToHtml(text: string): string {
  return text
    .split('\n\n')
    .map(block => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      const lines = trimmed.split('\n')
      const isList = lines.every(l => l.trim().startsWith('- ') || l.trim() === '')
      if (isList) {
        const items = lines.filter(l => l.trim().startsWith('- ')).map(l => `<li style="margin-bottom:4px">${fmtInline(l.trim().slice(2))}</li>`).join('')
        return `<ul style="margin:0 0 12px 20px;padding:0">${items}</ul>`
      }
      if (/^[A-Z][A-Z\s']+:?$/.test(trimmed)) return `<p style="margin:16px 0 8px 0;font-weight:600;font-size:14px">${trimmed}</p>`
      return `<p style="margin:0 0 12px 0">${fmtInline(trimmed.replace(/\n/g, '<br>'))}</p>`
    })
    .filter(Boolean)
    .join('')
}

function fmtInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

export function ReportsHub({ activeClients, initialReports }: { activeClients: Client[]; initialReports: Report[] }) {
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [selectedDays, setSelectedDays] = useState(7)
  const [generating, setGenerating] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [editingReport, setEditingReport] = useState<Report | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'overview' | 'client'>('overview')
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [copyFeedback, setCopyFeedback] = useState(false)

  const reloadReports = useCallback(async () => {
    try {
      const res = await fetch('/api/reports')
      const data = await res.json()
      setReports(data.reports || [])
    } catch {}
  }, [])

  // Group reports by client
  const reportsByClient = new Map<string, { client: Client; reports: Report[] }>()
  for (const client of activeClients) {
    reportsByClient.set(client.id, { client, reports: [] })
  }
  for (const report of reports) {
    const entry = reportsByClient.get(report.client_id)
    if (entry) entry.reports.push(report)
  }

  // Group reports by period
  const reportsByPeriod = new Map<string, Report[]>()
  for (const report of reports) {
    const key = `${report.period_start}_${report.period_end}`
    if (!reportsByPeriod.has(key)) reportsByPeriod.set(key, [])
    reportsByPeriod.get(key)!.push(report)
  }

  // Stats
  const totalReports = reports.length
  const draftCount = reports.filter(r => r.status === 'draft').length
  const reviewedCount = reports.filter(r => r.status === 'reviewed').length
  const sentCount = reports.filter(r => r.status === 'sent').length
  const clientsWithReports = new Set(reports.map(r => r.client_id)).size
  const clientsWithoutReports = activeClients.length - clientsWithReports

  async function generateReport(clientId: string) {
    setGeneratingId(clientId)
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: [clientId], days: selectedDays }),
      })
      const data = await res.json()
      if (data.results?.[0]?.status === 'error') alert(`Error: ${data.results[0].error}`)
      else await reloadReports()
    } catch { alert('Generation failed.') }
    setGeneratingId(null)
  }

  async function generateAll() {
    if (!confirm(`Generate ${selectedDays}-day reports for all active clients?`)) return
    setGenerating(true)
    try {
      await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: null, days: selectedDays }),
      })
      await reloadReports()
    } catch { alert('Generation failed.') }
    setGenerating(false)
  }

  async function updateStatus(reportId: string, status: string) {
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const updated = await res.json()
        setReports(prev => prev.map(r => r.id === reportId ? updated : r))
        if (editingReport?.id === reportId) setEditingReport(updated)
      }
    } catch {}
  }

  async function saveReport() {
    if (!editingReport) return
    setSaving(true)
    try {
      const res = await fetch(`/api/reports/${editingReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, notes: editNotes }),
      })
      if (res.ok) {
        const updated = await res.json()
        setReports(prev => prev.map(r => r.id === editingReport.id ? updated : r))
        setEditingReport(updated)
      }
    } catch {}
    setSaving(false)
  }

  async function regenerateReport(report: Report) {
    setGeneratingId(report.client_id)
    try {
      const start = new Date(report.period_start + 'T12:00:00')
      const end = new Date(report.period_end + 'T12:00:00')
      const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
      await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: [report.client_id], days }),
      })
      await reloadReports()
      if (editingReport?.id === report.id) setEditingReport(null)
    } catch { alert('Regeneration failed.') }
    setGeneratingId(null)
  }

  async function copyToClipboard(text: string) {
    try {
      const html = markdownToHtml(text)
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })
      ])
    } catch {
      await navigator.clipboard.writeText(text)
    }
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 2000)
  }

  // ═══════════════════ EDITOR VIEW ═══════════════════
  if (editingReport) {
    return (
      <div className="flex flex-col h-[calc(100vh-44px)]">
        <div className="border-b border-[#e8e8ec] px-4 sm:px-6 py-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setEditingReport(null)} className="text-[#9d9da8] hover:text-[#111113] flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2L4 8l6 6" /></svg>
            </button>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#111113] truncate">{editingReport.client_name}</p>
              <p className="text-[10px] text-[#9d9da8] truncate">
                {fmtDate(editingReport.period_start)} - {fmtDate(editingReport.period_end)}
              </p>
            </div>
            <StatusBadge status={editingReport.status} />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <button onClick={() => copyToClipboard(editContent)} className={`px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${copyFeedback ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'}`}>
              {copyFeedback ? 'Copied' : 'Copy for Email'}
            </button>
            <button onClick={() => regenerateReport(editingReport)} disabled={generatingId === editingReport.client_id} className="px-3 py-1.5 rounded bg-[#f4f4f6] text-[11px] font-medium text-[#6b6b76] hover:bg-[#e8e8ec] disabled:opacity-50">
              {generatingId === editingReport.client_id ? 'Regenerating...' : 'Regenerate'}
            </button>
            <button onClick={saveReport} disabled={saving} className="px-3 py-1.5 rounded bg-[#2563eb] text-white text-[11px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            {editingReport.status === 'draft' && (
              <button onClick={() => updateStatus(editingReport.id, 'reviewed')} className="px-3 py-1.5 rounded text-[11px] font-medium" style={{ backgroundColor: STATUS_CONFIG.reviewed.bg, color: STATUS_CONFIG.reviewed.color }}>
                Mark Reviewed
              </button>
            )}
            {editingReport.status === 'reviewed' && (
              <button onClick={() => updateStatus(editingReport.id, 'sent')} className="px-3 py-1.5 rounded text-[11px] font-medium" style={{ backgroundColor: STATUS_CONFIG.sent.bg, color: STATUS_CONFIG.sent.color }}>
                Mark Sent
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2 border-b border-[#e8e8ec] bg-[#f9f9fb]">
              <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Edit</p>
            </div>
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="flex-1 p-4 text-[13px] leading-relaxed text-[#111113] resize-none focus:outline-none font-mono" placeholder="Report content..." />
            <div className="px-4 py-2 border-t border-[#e8e8ec]">
              <input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Internal notes (not in report)..." className="w-full text-[12px] text-[#9d9da8] focus:outline-none" />
            </div>
          </div>
          <div className="flex-1 border-t md:border-t-0 md:border-l border-[#e8e8ec] flex flex-col min-h-0 bg-[#f9f9fb]">
            <div className="px-4 py-2 border-b border-[#e8e8ec]">
              <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Preview</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="max-w-[600px] mx-auto bg-white rounded border border-[#e8e8ec] p-6 sm:p-8 text-[13px] leading-relaxed text-[#111113]" dangerouslySetInnerHTML={{ __html: editContent ? markdownToHtml(editContent) : '<p style="color:#9d9da8">No content yet.</p>' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════ CLIENT DETAIL VIEW ═══════════════════
  if (view === 'client' && selectedClient) {
    const entry = reportsByClient.get(selectedClient)
    if (!entry) return null
    const clientReports = entry.reports.sort((a, b) => b.period_end.localeCompare(a.period_end))

    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        {/* Back + header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setView('overview'); setSelectedClient('') }} className="text-[#9d9da8] hover:text-[#111113]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2L4 8l6 6" /></svg>
          </button>
          <div>
            <h1 className="text-[20px] font-semibold text-[#111113] tracking-tight">{entry.client.name}</h1>
            <p className="text-[12px] text-[#9d9da8] mt-0.5">Report history — {clientReports.length} report{clientReports.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Generate new */}
        <div className="bg-white border border-[#e8e8ec] rounded-md p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#9d9da8]">Generate new report:</span>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setSelectedDays(p.value)} className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${selectedDays === p.value ? 'bg-[#111113] text-white' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'}`}>{p.label}</button>
            ))}
          </div>
          <button onClick={() => generateReport(selectedClient)} disabled={generatingId === selectedClient} className={`px-4 py-1.5 text-[12px] font-semibold rounded transition-colors ${generatingId === selectedClient ? 'bg-[#e8e8ec] text-[#9d9da8]' : 'bg-[#111113] text-white hover:bg-[#2a2a2e]'}`}>
            {generatingId === selectedClient ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Timeline */}
        {clientReports.length === 0 ? (
          <div className="bg-white border border-[#e8e8ec] rounded-md p-12 text-center">
            <p className="text-[13px] text-[#6b6b76]">No reports generated yet</p>
            <p className="text-[11px] text-[#9d9da8] mt-1">Generate a report above to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clientReports.map(report => (
              <div key={report.id} onClick={() => { setEditingReport(report); setEditContent(report.content || ''); setEditNotes(report.notes || '') }} className="bg-white border border-[#e8e8ec] rounded-md hover:border-[#2563eb] hover:shadow-sm transition-all cursor-pointer">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={report.status} />
                    <div>
                      <p className="text-[13px] font-medium text-[#111113]">{fmtDate(report.period_start)} — {fmtDate(report.period_end)}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {report.generated_at && <span className="text-[10px] text-[#9d9da8]">Generated {fmtFull(report.generated_at)}</span>}
                        {report.reviewed_at && <span className="text-[10px] text-[#f59e0b]">Reviewed {fmtFull(report.reviewed_at)}</span>}
                        {report.sent_at && <span className="text-[10px] text-[#16a34a]">Sent {fmtFull(report.sent_at)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.content && (
                      <button onClick={e => { e.stopPropagation(); copyToClipboard(report.content!) }} className="text-[10px] text-[#9d9da8] hover:text-[#111113] px-2 py-1 rounded hover:bg-[#f4f4f6] transition-colors">
                        Copy
                      </button>
                    )}
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#9d9da8" strokeWidth="2" strokeLinecap="round"><path d="M6 2l6 6-6 6" /></svg>
                  </div>
                </div>
                {/* Content preview */}
                {report.content && (
                  <div className="px-4 pb-3">
                    <p className="text-[11px] text-[#9d9da8] line-clamp-2 leading-relaxed">{report.content.replace(/\*\*/g, '').replace(/\n/g, ' ').slice(0, 200)}...</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════ OVERVIEW ═══════════════════
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-[#111113] tracking-tight">Reports</h1>
          <p className="text-[12px] text-[#9d9da8] mt-0.5">Weekly client performance reports</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setSelectedDays(p.value)} className={`px-2.5 py-1.5 text-[11px] font-medium rounded transition-colors ${selectedDays === p.value ? 'bg-[#111113] text-white' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'}`}>{p.label}</button>
          ))}
          <button onClick={generateAll} disabled={generating} className={`ml-1 px-4 py-1.5 text-[12px] font-semibold rounded transition-colors ${generating ? 'bg-[#e8e8ec] text-[#9d9da8]' : 'bg-[#111113] text-white hover:bg-[#2a2a2e]'}`}>
            {generating ? 'Generating...' : 'Generate All'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-[#e8e8ec] rounded-md p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium">Total</p>
          <p className="text-[18px] font-semibold text-[#111113] mt-0.5">{totalReports}</p>
        </div>
        <div className="bg-white border border-[#e8e8ec] rounded-md p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#2563eb] font-medium">Drafts</p>
          <p className="text-[18px] font-semibold text-[#2563eb] mt-0.5">{draftCount}</p>
        </div>
        <div className="bg-white border border-[#e8e8ec] rounded-md p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#f59e0b] font-medium">Reviewed</p>
          <p className="text-[18px] font-semibold text-[#f59e0b] mt-0.5">{reviewedCount}</p>
        </div>
        <div className="bg-white border border-[#e8e8ec] rounded-md p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#16a34a] font-medium">Sent</p>
          <p className="text-[18px] font-semibold text-[#16a34a] mt-0.5">{sentCount}</p>
        </div>
        <div className="bg-white border border-[#e8e8ec] rounded-md p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#dc2626] font-medium">Missing</p>
          <p className="text-[18px] font-semibold text-[#dc2626] mt-0.5">{clientsWithoutReports}</p>
          <p className="text-[10px] text-[#9d9da8]">of {activeClients.length} clients</p>
        </div>
      </div>

      {/* Client grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeClients.map(client => {
          const entry = reportsByClient.get(client.id)
          const clientReports = entry?.reports.sort((a, b) => b.period_end.localeCompare(a.period_end)) || []
          const latest = clientReports[0]
          const totalSent = clientReports.filter(r => r.status === 'sent').length

          return (
            <div key={client.id} className="bg-white border border-[#e8e8ec] rounded-md overflow-hidden hover:border-[#2563eb]/30 transition-colors">
              {/* Client header */}
              <div className="p-3 flex items-start justify-between">
                <div className="cursor-pointer min-w-0" onClick={() => { setView('client'); setSelectedClient(client.id) }}>
                  <p className="text-[13px] font-semibold text-[#111113] truncate">{client.name}</p>
                  {client.industry && <p className="text-[10px] text-[#9d9da8] mt-0.5">{client.industry}</p>}
                </div>
                <button
                  onClick={() => generateReport(client.id)}
                  disabled={generatingId === client.id}
                  className={`shrink-0 px-2.5 py-1 text-[10px] font-semibold rounded transition-colors ${
                    generatingId === client.id ? 'bg-[#e8e8ec] text-[#9d9da8]' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec] hover:text-[#111113]'
                  }`}
                >
                  {generatingId === client.id ? '...' : `${selectedDays}d`}
                </button>
              </div>

              {/* Latest report or empty state */}
              {latest ? (
                <div className="border-t border-[#f4f4f6]">
                  <div
                    onClick={() => { setEditingReport(latest); setEditContent(latest.content || ''); setEditNotes(latest.notes || '') }}
                    className="px-3 py-2.5 hover:bg-[#f9f9fb] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={latest.status} />
                        <span className="text-[11px] text-[#6b6b76]">{fmtDate(latest.period_start)} — {fmtDate(latest.period_end)}</span>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#c4c4cc" strokeWidth="2" strokeLinecap="round"><path d="M6 2l6 6-6 6" /></svg>
                    </div>
                    {latest.content && (
                      <p className="text-[10px] text-[#9d9da8] mt-1 line-clamp-1">{latest.content.replace(/\*\*/g, '').replace(/\n/g, ' ').slice(0, 120)}</p>
                    )}
                  </div>

                  {/* History count */}
                  {clientReports.length > 1 && (
                    <div className="px-3 py-1.5 border-t border-[#f4f4f6] bg-[#f9f9fb]">
                      <button onClick={() => { setView('client'); setSelectedClient(client.id) }} className="text-[10px] text-[#9d9da8] hover:text-[#2563eb] transition-colors">
                        {clientReports.length - 1} more report{clientReports.length > 2 ? 's' : ''} — {totalSent} sent
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-t border-[#f4f4f6] px-3 py-3">
                  <p className="text-[10px] text-[#c4c4cc]">No reports yet</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
