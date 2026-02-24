'use client'

import { useState } from 'react'
import Link from 'next/link'

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

export function ReportsHub({
  weeks,
  activeClients,
  initialReports,
  initialWeek,
}: {
  weeks: string[]
  activeClients: Client[]
  initialReports: Report[]
  initialWeek: string | null
}) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(initialWeek)
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [generating, setGenerating] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [editingReport, setEditingReport] = useState<Report | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingWeek, setLoadingWeek] = useState(false)
  const [allWeeks, setAllWeeks] = useState(weeks)

  async function loadWeek(week: string) {
    setLoadingWeek(true)
    setSelectedWeek(week)
    try {
      const res = await fetch(`/api/reports?week=${week}`)
      const data = await res.json()
      setReports(data.reports || [])
    } catch {
      setReports([])
    }
    setLoadingWeek(false)
  }

  async function generateAll() {
    if (!confirm('Generate reports for all active clients? This will use AI credits.')) return
    setGenerating(true)
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: null }),
      })
      const data = await res.json()
      if (data.week) {
        if (!allWeeks.includes(data.week)) setAllWeeks([data.week, ...allWeeks])
        await loadWeek(data.week)
      }
    } catch (e) {
      alert('Generation failed. Check console.')
      console.error(e)
    }
    setGenerating(false)
  }

  async function generateOne(clientId: string) {
    setGeneratingId(clientId)
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: [clientId] }),
      })
      const data = await res.json()
      if (data.week) {
        if (!allWeeks.includes(data.week)) setAllWeeks([data.week, ...allWeeks])
        await loadWeek(data.week)
      }
    } catch (e) {
      alert('Generation failed.')
      console.error(e)
    }
    setGeneratingId(null)
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

  function openEditor(report: Report) {
    setEditingReport(report)
    setEditContent(report.content || '')
    setEditNotes(report.notes || '')
  }

  // Stats
  const totalClients = activeClients.length
  const generated = reports.filter(r => r.status !== 'pending').length
  const reviewed = reports.filter(r => r.status === 'reviewed' || r.status === 'sent').length
  const sent = reports.filter(r => r.status === 'sent').length

  // Find clients without reports this week
  const reportedClientIds = new Set(reports.map(r => r.client_id))
  const missingClients = activeClients.filter(c => !reportedClientIds.has(c.id))

  // EDITOR VIEW
  if (editingReport) {
    return (
      <div className="flex flex-col h-[calc(100vh-44px)]">
        {/* Editor header */}
        <div className="border-b border-[#e8e8ec] px-6 py-3 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setEditingReport(null)} className="text-[#9d9da8] hover:text-[#111113]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2L4 8l6 6" /></svg>
            </button>
            <div>
              <p className="text-[13px] font-semibold text-[#111113]">{editingReport.client_name}</p>
              <p className="text-[10px] text-[#9d9da8]">
                {editingReport.subject} &middot; <StatusBadge status={editingReport.status} />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={saveReport} disabled={saving} className="px-4 py-2 rounded bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            {editingReport.status === 'draft' && (
              <button onClick={() => updateStatus(editingReport.id, 'reviewed')} className="px-4 py-2 rounded bg-[#ca8a04] text-white text-[12px] font-medium hover:bg-[#a16207]">
                Mark Reviewed
              </button>
            )}
            {(editingReport.status === 'draft' || editingReport.status === 'reviewed') && (
              <button onClick={() => updateStatus(editingReport.id, 'sent')} className="px-4 py-2 rounded bg-[#16a34a] text-white text-[12px] font-medium hover:bg-[#15803d]">
                Mark Sent
              </button>
            )}
          </div>
        </div>

        {/* Editor body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Edit pane */}
          <div className="flex-1 flex flex-col border-r border-[#e8e8ec]">
            <div className="px-4 py-2 border-b border-[#f4f4f6] bg-[#fafafb]">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Edit Report</p>
            </div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="flex-1 p-4 text-[13px] text-[#111113] leading-relaxed font-mono resize-none focus:outline-none bg-white"
              placeholder="Report content..."
            />
            <div className="px-4 py-3 border-t border-[#f4f4f6] bg-[#fafafb]">
              <label className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider block mb-1">Internal Notes</label>
              <input
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Notes about this report (not sent to client)"
                className="w-full px-3 py-2 rounded bg-white border border-[#e8e8ec] text-[12px] focus:outline-none focus:border-[#2563eb]"
              />
            </div>
          </div>

          {/* Preview pane */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 border-b border-[#f4f4f6] bg-[#fafafb]">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Preview</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-[600px] mx-auto">
                <p className="text-[11px] text-[#9d9da8] mb-4 font-medium">Subject: {editingReport.subject}</p>
                <div className="text-[13px] text-[#333] leading-relaxed whitespace-pre-wrap">
                  {editContent.split('\n').map((line, i) => {
                    if (/^[A-Z\s']{4,}$/.test(line.trim()) && line.trim().length > 3) {
                      return <p key={i} className="font-semibold text-[#111113] mt-4 mb-2 text-[14px]">{line}</p>
                    }
                    if (line.startsWith('- ')) {
                      const formatted = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      return <p key={i} className="pl-3 mb-1" dangerouslySetInnerHTML={{ __html: '&bull; ' + formatted }} />
                    }
                    if (line.trim() === '') return <br key={i} />
                    const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#2563eb] underline">$1</a>')
                    return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: formatted }} />
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // LIST VIEW
  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[20px] font-semibold text-[#111113] tracking-tight">Weekly Reports</h2>
          <p className="text-[13px] text-[#9d9da8] mt-0.5">Generate, review, and track client reports</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateAll}
            disabled={generating}
            className="px-4 py-2 rounded bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {generating ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" /><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                Generating...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v12M2 8h12" /></svg>
                Generate All Reports
              </>
            )}
          </button>
        </div>
      </div>

      {/* Week picker + Stats */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Week</label>
          <select
            value={selectedWeek || ''}
            onChange={e => e.target.value && loadWeek(e.target.value)}
            className="px-3 py-2 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb]"
          >
            {!selectedWeek && <option value="">No reports yet</option>}
            {allWeeks.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>

        {selectedWeek && (
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
              <span className="text-[11px] text-[#6b6b76]">{generated} drafted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ca8a04]" />
              <span className="text-[11px] text-[#6b6b76]">{reviewed} reviewed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
              <span className="text-[11px] text-[#6b6b76]">{sent}/{totalClients} sent</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {selectedWeek && reports.length > 0 && (
        <div className="w-full h-1.5 rounded-full bg-[#e8e8ec] mb-6 overflow-hidden flex">
          {sent > 0 && <div className="h-full bg-[#16a34a]" style={{ width: `${(sent / totalClients) * 100}%` }} />}
          {(reviewed - sent) > 0 && <div className="h-full bg-[#ca8a04]" style={{ width: `${((reviewed - sent) / totalClients) * 100}%` }} />}
          {(generated - reviewed) > 0 && <div className="h-full bg-[#2563eb]" style={{ width: `${((generated - reviewed) / totalClients) * 100}%` }} />}
        </div>
      )}

      {/* Report cards */}
      {loadingWeek ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-md bg-[#f8f8fa] border border-[#e8e8ec] animate-pulse" />
          ))}
        </div>
      ) : reports.length > 0 ? (
        <div className="space-y-2">
          {reports.map(report => (
            <div
              key={report.id}
              className="rounded-md border border-[#e8e8ec] bg-white hover:bg-[#fafafb] transition-colors"
            >
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link href={`/clients/${activeClients.find(c => c.id === report.client_id)?.slug || '#'}`} className="text-[13px] font-medium text-[#111113] hover:text-[#2563eb]">
                        {report.client_name}
                      </Link>
                      <StatusBadge status={report.status} />
                    </div>
                    <p className="text-[11px] text-[#9d9da8] truncate">
                      {report.subject || `${formatDate(report.period_start)} - ${formatDate(report.period_end)}`}
                      {report.generated_at && ` · Generated ${new Date(report.generated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {report.content && (
                    <button
                      onClick={() => openEditor(report)}
                      className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors"
                    >
                      {report.status === 'sent' ? 'View' : 'Edit'}
                    </button>
                  )}
                  {report.status === 'draft' && (
                    <button
                      onClick={() => updateStatus(report.id, 'reviewed')}
                      className="px-3 py-1.5 rounded text-[11px] font-medium text-[#ca8a04] bg-[#fefce8] border border-[#fde68a] hover:bg-[#fef9c3] transition-colors"
                    >
                      Reviewed
                    </button>
                  )}
                  {(report.status === 'draft' || report.status === 'reviewed') && (
                    <button
                      onClick={() => updateStatus(report.id, 'sent')}
                      className="px-3 py-1.5 rounded text-[11px] font-medium text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] hover:bg-[#dcfce7] transition-colors"
                    >
                      Sent
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !selectedWeek ? (
        <div className="rounded-md border border-[#e8e8ec] bg-white px-8 py-16 text-center">
          <div className="w-12 h-12 rounded-md bg-[#f8f8fa] border border-[#e8e8ec] flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#9d9da8" strokeWidth="1.5" strokeLinecap="round"><path d="M4 2h12v16H4z" /><path d="M7 6h6M7 9h6M7 12h4" /></svg>
          </div>
          <h3 className="text-[14px] font-semibold text-[#111113] mb-1">No reports yet</h3>
          <p className="text-[12px] text-[#9d9da8] mb-4">Generate your first batch of weekly client reports.</p>
          <button
            onClick={generateAll}
            disabled={generating}
            className="px-4 py-2 rounded bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            Generate Reports
          </button>
        </div>
      ) : null}

      {/* Missing clients */}
      {selectedWeek && missingClients.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[10px] font-medium text-[#9d9da8] uppercase tracking-wider mb-2">Not Generated ({missingClients.length})</h3>
          <div className="space-y-1">
            {missingClients.map(c => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 rounded-md border border-dashed border-[#e8e8ec] bg-[#fafafb]">
                <div>
                  <p className="text-[12px] font-medium text-[#9d9da8]">{c.name}</p>
                  {c.industry && <p className="text-[10px] text-[#c4c4cc]">{c.industry}</p>}
                </div>
                <button
                  onClick={() => generateOne(c.id)}
                  disabled={generatingId === c.id}
                  className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#6b6b76] hover:bg-white disabled:opacity-50 transition-colors"
                >
                  {generatingId === c.id ? 'Generating...' : 'Generate'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
