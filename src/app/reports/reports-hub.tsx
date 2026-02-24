'use client'

import { useState } from 'react'

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

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-[#f8f8fa]', text: 'text-[#9d9da8]', border: 'border-[#e8e8ec]' },
  draft: { bg: 'bg-[#eff6ff]', text: 'text-[#2563eb]', border: 'border-[#bfdbfe]' },
  reviewed: { bg: 'bg-[#fefce8]', text: 'text-[#ca8a04]', border: 'border-[#fde68a]' },
  sent: { bg: 'bg-[#f0fdf4]', text: 'text-[#16a34a]', border: 'border-[#bbf7d0]' },
}

function StatusBadge({ status }: { status: string }) {
  const s = statusColors[status] || statusColors.pending
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${s.bg} ${s.text} border ${s.border}`}>
      {status}
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PERIOD_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '14 Days', value: 14 },
  { label: '30 Days', value: 30 },
  { label: '60 Days', value: 60 },
  { label: '90 Days', value: 90 },
]

export function ReportsHub({
  activeClients,
  initialReports,
}: {
  activeClients: Client[]
  initialReports: Report[]
}) {
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [selectedDays, setSelectedDays] = useState(7)
  const [generating, setGenerating] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [editingReport, setEditingReport] = useState<Report | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  async function generateReport(clientId: string) {
    setGeneratingId(clientId)
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: [clientId], days: selectedDays }),
      })
      const data = await res.json()
      if (data.results?.[0]?.status === 'error') {
        alert(`Error: ${data.results[0].error}`)
      } else {
        // Reload reports
        await reloadReports()
      }
    } catch (e) {
      alert('Generation failed.')
      console.error(e)
    }
    setGeneratingId(null)
  }

  async function generateAll() {
    if (!confirm(`Generate ${selectedDays}-day reports for all active clients? This will use AI credits.`)) return
    setGenerating(true)
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: null, days: selectedDays }),
      })
      const data = await res.json()
      const succeeded = data.results?.filter((r: any) => r.status === 'generated').length || 0
      const failed = data.results?.filter((r: any) => r.status === 'error').length || 0
      if (failed > 0) alert(`Generated ${succeeded} reports, ${failed} failed.`)
      await reloadReports()
    } catch (e) {
      alert('Generation failed.')
      console.error(e)
    }
    setGenerating(false)
  }

  async function reloadReports() {
    try {
      const res = await fetch('/api/reports')
      const data = await res.json()
      setReports(data.reports || [])
    } catch {}
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
      // Parse days from the report period
      const start = new Date(report.period_start + 'T12:00:00')
      const end = new Date(report.period_end + 'T12:00:00')
      const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1

      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: [report.client_id], days }),
      })
      if (res.ok) {
        await reloadReports()
        // If editing this report, close editor
        if (editingReport?.id === report.id) setEditingReport(null)
      }
    } catch (e) {
      alert('Regeneration failed.')
    }
    setGeneratingId(null)
  }

  function openEditor(report: Report) {
    setEditingReport(report)
    setEditContent(report.content || '')
    setEditNotes(report.notes || '')
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {}
  }

  // Filter reports
  const filteredReports = reports
    .filter(r => selectedClient === 'all' || r.client_id === selectedClient)
    .filter(r => !searchQuery || r.client_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Most recent first
      if (a.period_end !== b.period_end) return b.period_end.localeCompare(a.period_end)
      return a.client_name.localeCompare(b.client_name)
    })

  // Stats
  const totalReports = reports.length
  const draftCount = reports.filter(r => r.status === 'draft').length
  const reviewedCount = reports.filter(r => r.status === 'reviewed').length
  const sentCount = reports.filter(r => r.status === 'sent').length

  // EDITOR VIEW
  if (editingReport) {
    return (
      <div className="flex flex-col h-[calc(100vh-44px)]">
        {/* Editor header */}
        <div className="border-b border-[#e8e8ec] px-4 sm:px-6 py-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setEditingReport(null)} className="text-[#9d9da8] hover:text-[#111113] flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2L4 8l6 6" /></svg>
            </button>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#111113] truncate">{editingReport.client_name}</p>
              <p className="text-[10px] text-[#9d9da8] truncate">
                {formatDate(editingReport.period_start)} - {formatDate(editingReport.period_end)} &middot; <StatusBadge status={editingReport.status} />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <button
              onClick={() => copyToClipboard(editContent)}
              className="px-3 py-2 rounded border border-[#e8e8ec] text-[12px] font-medium text-[#111113] hover:bg-[#f8f8fa]"
            >
              Copy
            </button>
            <button
              onClick={() => regenerateReport(editingReport)}
              disabled={generatingId === editingReport.client_id}
              className="px-3 py-2 rounded border border-[#e8e8ec] text-[12px] font-medium text-[#111113] hover:bg-[#f8f8fa] disabled:opacity-50"
            >
              {generatingId === editingReport.client_id ? 'Regenerating...' : 'Regenerate'}
            </button>
            <button onClick={saveReport} disabled={saving} className="px-4 py-2 rounded bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            {editingReport.status === 'draft' && (
              <button onClick={() => updateStatus(editingReport.id, 'reviewed')} className="px-3 py-2 rounded bg-[#ca8a04] text-white text-[12px] font-medium hover:bg-[#a16207]">
                Mark Reviewed
              </button>
            )}
            {editingReport.status === 'reviewed' && (
              <button onClick={() => updateStatus(editingReport.id, 'sent')} className="px-3 py-2 rounded bg-[#16a34a] text-white text-[12px] font-medium hover:bg-[#15803d]">
                Mark Sent
              </button>
            )}
          </div>
        </div>

        {/* Split pane: editor + preview */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Editor */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2 border-b border-[#e8e8ec] bg-[#f8f8fa]">
              <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Edit</p>
            </div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="flex-1 p-4 text-[13px] leading-relaxed text-[#111113] resize-none focus:outline-none font-mono"
              placeholder="Report content..."
            />
            <div className="px-4 py-2 border-t border-[#e8e8ec]">
              <input
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Internal notes (not included in report)..."
                className="w-full text-[12px] text-[#9d9da8] focus:outline-none"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 border-t md:border-t-0 md:border-l border-[#e8e8ec] flex flex-col min-h-0 bg-[#fafafa]">
            <div className="px-4 py-2 border-b border-[#e8e8ec]">
              <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Preview</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="max-w-[600px] mx-auto bg-white rounded border border-[#e8e8ec] p-6 sm:p-8 text-[13px] leading-relaxed text-[#111113] whitespace-pre-wrap">
                {editContent || 'No content yet.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // MAIN VIEW — Report Builder
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-[#111113]">Reports</h1>
          <p className="text-[12px] text-[#9d9da8] mt-1">Generate and manage client performance reports</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center border border-[#e8e8ec] rounded overflow-hidden">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedDays(opt.value)}
                className={`px-3 py-1.5 text-[11px] font-medium border-r border-[#e8e8ec] last:border-r-0 transition-colors ${
                  selectedDays === opt.value
                    ? 'bg-[#111113] text-white'
                    : 'bg-white text-[#9d9da8] hover:text-[#111113] hover:bg-[#f8f8fa]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={generateAll}
            disabled={generating}
            className="px-4 py-1.5 rounded bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {generating ? 'Generating All...' : 'Generate All'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-[#e8e8ec] rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Total Reports</p>
          <p className="text-[18px] font-semibold text-[#111113] mt-1">{totalReports}</p>
        </div>
        <div className="bg-white border border-[#e8e8ec] rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Drafts</p>
          <p className="text-[18px] font-semibold text-[#2563eb] mt-1">{draftCount}</p>
        </div>
        <div className="bg-white border border-[#e8e8ec] rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Reviewed</p>
          <p className="text-[18px] font-semibold text-[#ca8a04] mt-1">{reviewedCount}</p>
        </div>
        <div className="bg-white border border-[#e8e8ec] rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Sent</p>
          <p className="text-[18px] font-semibold text-[#16a34a] mt-1">{sentCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search clients..."
          className="px-3 py-2 border border-[#e8e8ec] rounded text-[12px] text-[#111113] focus:outline-none focus:border-[#2563eb] w-full sm:w-64"
        />
        <select
          value={selectedClient}
          onChange={e => setSelectedClient(e.target.value)}
          className="px-3 py-2 border border-[#e8e8ec] rounded text-[12px] text-[#111113] focus:outline-none bg-white"
        >
          <option value="all">All Clients</option>
          {activeClients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Client list with generate buttons */}
      <div className="space-y-2">
        {activeClients
          .filter(c => selectedClient === 'all' || c.id === selectedClient)
          .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(client => {
            const clientReports = filteredReports.filter(r => r.client_id === client.id)
            const latestReport = clientReports[0]

            return (
              <div key={client.id} className="bg-white border border-[#e8e8ec] rounded">
                {/* Client row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#111113] truncate">{client.name}</p>
                      {client.industry && (
                        <p className="text-[10px] text-[#9d9da8]">{client.industry}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {latestReport && <StatusBadge status={latestReport.status} />}
                    <button
                      onClick={() => generateReport(client.id)}
                      disabled={generatingId === client.id}
                      className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#111113] hover:bg-[#f8f8fa] disabled:opacity-50"
                    >
                      {generatingId === client.id ? 'Generating...' : `Generate ${selectedDays}d`}
                    </button>
                  </div>
                </div>

                {/* Reports for this client */}
                {clientReports.length > 0 && (
                  <div className="border-t border-[#e8e8ec]">
                    {clientReports.map(report => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between px-4 py-2 hover:bg-[#f8f8fa] cursor-pointer border-b border-[#e8e8ec] last:border-b-0"
                        onClick={() => openEditor(report)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <StatusBadge status={report.status} />
                          <span className="text-[12px] text-[#111113] truncate">
                            {formatDate(report.period_start)} - {formatDate(report.period_end)}
                          </span>
                          {report.subject && (
                            <span className="text-[11px] text-[#9d9da8] truncate hidden sm:inline">
                              {report.subject}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {report.generated_at && (
                            <span className="text-[10px] text-[#9d9da8] hidden sm:inline">
                              Generated {new Date(report.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          )}
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#9d9da8" strokeWidth="2" strokeLinecap="round"><path d="M6 2l6 6-6 6" /></svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {activeClients.length === 0 && (
        <div className="text-center py-12 text-[#9d9da8]">
          <p className="text-[13px]">No active clients found.</p>
        </div>
      )}
    </div>
  )
}
