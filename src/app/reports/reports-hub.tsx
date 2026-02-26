'use client'

import { useState, useCallback } from 'react'
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

interface ReportSettings {
  report_day: number
  report_time: string
  report_auto_generate: boolean
  report_default_days: number
  report_timezone: string
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS = {
  pending: { label: 'Pending', color: '#9d9da8', bg: '#f4f4f6' },
  draft: { label: 'Draft', color: '#2563eb', bg: '#dbeafe' },
  reviewed: { label: 'Reviewed', color: '#f59e0b', bg: '#fef3c7' },
  sent: { label: 'Sent', color: '#16a34a', bg: '#dcfce7' },
} as const

function Badge({ status }: { status: string }) {
  const s = STATUS[status as keyof typeof STATUS] || STATUS.pending
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
}

function fmtShort(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function fmtFull(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }

// Get the target day of the current week in the given timezone
function getCurrentTargetDay(targetDay: number, tz: string): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
  const day = now.getDay()
  const diff = day >= targetDay ? day - targetDay : day + 7 - targetDay
  const target = new Date(now)
  target.setDate(now.getDate() - diff)
  return target.toISOString().split('T')[0]
}

function getTargetDayOffset(base: string, weeksBack: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() - (weeksBack * 7))
  return d.toISOString().split('T')[0]
}

function getWeekLabel(date: string, currentWeekDate: string): string {
  if (date === currentWeekDate) return 'This Week'
  const lastWeek = getTargetDayOffset(currentWeekDate, 1)
  if (date === lastWeek) return 'Last Week'
  return `Week of ${fmtShort(date)}`
}

// Assign a report to a week based on period_end and configured report day
function getReportWeekDate(report: Report, reportDay: number): string {
  const end = new Date(report.period_end + 'T12:00:00')
  const day = end.getDay()
  // Find the next target day after period_end
  const daysUntil = day <= reportDay ? reportDay - day : 7 - day + reportDay
  const target = new Date(end)
  target.setDate(end.getDate() + (daysUntil === 0 ? 0 : daysUntil))
  return target.toISOString().split('T')[0]
}

const PERIODS = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '60d', value: 60 },
  { label: '90d', value: 90 },
]

function markdownToHtml(text: string): string {
  return text.split('\n\n').map(block => {
    const t = block.trim()
    if (!t) return ''
    const lines = t.split('\n')
    if (lines.every(l => l.trim().startsWith('- ') || !l.trim())) {
      return `<ul style="margin:0 0 12px 20px;padding:0">${lines.filter(l => l.trim().startsWith('- ')).map(l => `<li style="margin-bottom:4px">${l.trim().slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</li>`).join('')}</ul>`
    }
    if (/^[A-Z][A-Z\s']+:?$/.test(t)) return `<p style="margin:16px 0 8px 0;font-weight:600;font-size:14px">${t}</p>`
    return `<p style="margin:0 0 12px 0">${t.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`
  }).filter(Boolean).join('')
}

export function ReportsHub({ activeClients, initialReports, reportSettings }: { activeClients: Client[]; initialReports: Report[]; reportSettings: ReportSettings }) {
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [selectedDays, setSelectedDays] = useState(reportSettings.report_default_days)
  const [generating, setGenerating] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Report | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [copyOk, setCopyOk] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null)
  const [clientView, setClientView] = useState<string | null>(null)

  const reportDay = reportSettings.report_day
  const tz = reportSettings.report_timezone

  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/reports')
      const d = await r.json()
      setReports(d.reports || [])
    } catch {}
  }, [])

  // Build week structure using configured report day
  const currentWeekDate = getCurrentTargetDay(reportDay, tz)
  const weeks = new Map<string, Map<string, Report>>()

  for (const report of reports) {
    const weekDate = getReportWeekDate(report, reportDay)
    if (!weeks.has(weekDate)) weeks.set(weekDate, new Map())
    const weekMap = weeks.get(weekDate)!
    const existing = weekMap.get(report.client_id)
    if (!existing || report.period_end > existing.period_end) {
      weekMap.set(report.client_id, report)
    }
  }

  if (!weeks.has(currentWeekDate)) weeks.set(currentWeekDate, new Map())
  const sortedWeeks = [...weeks.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  const currentWeekReports = weeks.get(currentWeekDate) || new Map()
  const cwSent = [...currentWeekReports.values()].filter(r => r.status === 'sent').length
  const cwDraft = [...currentWeekReports.values()].filter(r => r.status === 'draft' || r.status === 'reviewed').length
  const cwMissing = activeClients.length - currentWeekReports.size

  const getClientReports = (clientId: string) =>
    reports.filter(r => r.client_id === clientId).sort((a, b) => b.period_end.localeCompare(a.period_end))

  // Actions
  async function generateReport(clientId: string) {
    setGeneratingId(clientId)
    try {
      const res = await fetch('/api/reports/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientIds: [clientId], days: selectedDays }) })
      const data = await res.json()
      if (data.results?.[0]?.status === 'error') alert(`Error: ${data.results[0].error}`)
      else await reload()
    } catch { alert('Failed.') }
    setGeneratingId(null)
  }

  async function generateAll() {
    if (!confirm(`Generate ${selectedDays}-day reports for all ${activeClients.length} clients?`)) return
    setGenerating(true)
    try {
      await fetch('/api/reports/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientIds: null, days: selectedDays }) })
      await reload()
    } catch { alert('Failed.') }
    setGenerating(false)
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      if (res.ok) {
        const updated = await res.json()
        setReports(prev => prev.map(r => r.id === id ? updated : r))
        if (editing?.id === id) setEditing(updated)
      }
    } catch {}
  }

  async function batchUpdateStatus(reportIds: string[], status: string) {
    for (const id of reportIds) {
      await updateStatus(id, status)
    }
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/reports/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: editContent, notes: editNotes }) })
      if (res.ok) {
        const updated = await res.json()
        setReports(prev => prev.map(r => r.id === editing.id ? updated : r))
        setEditing(updated)
      }
    } catch {}
    setSaving(false)
  }

  async function regenerate(report: Report) {
    setGeneratingId(report.client_id)
    try {
      const days = Math.round((new Date(report.period_end + 'T12:00:00').getTime() - new Date(report.period_start + 'T12:00:00').getTime()) / 86400000) + 1
      await fetch('/api/reports/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientIds: [report.client_id], days }) })
      await reload()
      if (editing?.id === report.id) setEditing(null)
    } catch { alert('Failed.') }
    setGeneratingId(null)
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([markdownToHtml(text)], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })])
    } catch { await navigator.clipboard.writeText(text) }
    setCopyOk(true)
    setTimeout(() => setCopyOk(false), 2000)
  }

  function openEditor(r: Report) { setEditing(r); setEditContent(r.content || ''); setEditNotes(r.notes || '') }

  const BackButton = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="text-[#9d9da8] hover:text-[#111113]">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2L4 8l6 6" /></svg>
    </button>
  )

  // ═══════════════════ EDITOR ═══════════════════
  if (editing) {
    return (
      <div className="flex flex-col h-[calc(100vh-44px)]">
        <div className="border-b border-[#e8e8ec] px-4 sm:px-6 py-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <BackButton onClick={() => setEditing(null)} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#111113] truncate">{editing.client_name}</p>
              <p className="text-[10px] text-[#9d9da8]">{fmtShort(editing.period_start)} — {fmtShort(editing.period_end)}</p>
            </div>
            <Badge status={editing.status} />
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button onClick={() => copy(editContent)} className={`px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${copyOk ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'}`}>
              {copyOk ? 'Copied for Gmail' : 'Copy for Email'}
            </button>
            <button onClick={() => regenerate(editing)} disabled={generatingId === editing.client_id} className="px-3 py-1.5 rounded bg-[#f4f4f6] text-[11px] font-medium text-[#6b6b76] hover:bg-[#e8e8ec] disabled:opacity-50">
              {generatingId === editing.client_id ? '...' : 'Regenerate'}
            </button>
            <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded bg-[#2563eb] text-white text-[11px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50">
              {saving ? '...' : 'Save'}
            </button>
            {editing.status === 'draft' && (
              <button onClick={() => updateStatus(editing.id, 'reviewed')} className="px-3 py-1.5 rounded text-[11px] font-semibold" style={{ backgroundColor: '#fef3c7', color: '#f59e0b' }}>
                Mark Reviewed
              </button>
            )}
            {(editing.status === 'draft' || editing.status === 'reviewed') && (
              <button onClick={() => updateStatus(editing.id, 'sent')} className="px-3 py-1.5 rounded text-[11px] font-semibold" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
                Mark Sent
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2 border-b border-[#e8e8ec] bg-[#f9f9fb]"><p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Edit</p></div>
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="flex-1 p-4 text-[13px] leading-relaxed text-[#111113] resize-none focus:outline-none font-mono" />
            <div className="px-4 py-2 border-t border-[#e8e8ec]">
              <input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Internal notes..." className="w-full text-[12px] text-[#9d9da8] focus:outline-none" />
            </div>
          </div>
          <div className="flex-1 border-t md:border-t-0 md:border-l border-[#e8e8ec] flex flex-col min-h-0 bg-[#f9f9fb]">
            <div className="px-4 py-2 border-b border-[#e8e8ec]"><p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Preview</p></div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="max-w-[600px] mx-auto bg-white rounded border border-[#e8e8ec] p-6 sm:p-8 text-[13px] leading-relaxed text-[#111113]" dangerouslySetInnerHTML={{ __html: editContent ? markdownToHtml(editContent) : '<p style="color:#9d9da8">No content yet.</p>' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════ CLIENT HISTORY ═══════════════════
  if (clientView) {
    const client = activeClients.find(c => c.id === clientView)
    const history = getClientReports(clientView)

    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <BackButton onClick={() => setClientView(null)} />
          <div>
            <h1 className="text-[20px] font-semibold text-[#111113] tracking-tight">{client?.name || 'Client'}</h1>
            <p className="text-[12px] text-[#9d9da8] mt-0.5">{history.length} report{history.length !== 1 ? 's' : ''} — {history.filter(r => r.status === 'sent').length} sent</p>
          </div>
        </div>

        {/* Quick generate */}
        <div className="bg-white border border-[#e8e8ec] rounded-md p-4 mb-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#9d9da8]">New report:</span>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setSelectedDays(p.value)} className={`px-2 py-1 text-[11px] font-medium rounded ${selectedDays === p.value ? 'bg-[#111113] text-white' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'}`}>{p.label}</button>
            ))}
          </div>
          <button onClick={() => generateReport(clientView)} disabled={generatingId === clientView} className={`px-4 py-1.5 text-[12px] font-semibold rounded ${generatingId === clientView ? 'bg-[#e8e8ec] text-[#9d9da8]' : 'bg-[#111113] text-white hover:bg-[#2a2a2e]'}`}>
            {generatingId === clientView ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {history.length === 0 ? (
          <div className="bg-white border border-[#e8e8ec] rounded-md p-12 text-center">
            <p className="text-[13px] text-[#6b6b76]">No reports yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(r => (
              <div key={r.id} onClick={() => openEditor(r)} className="bg-white border border-[#e8e8ec] rounded-md hover:border-[#2563eb] hover:shadow-sm cursor-pointer transition-all p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge status={r.status} />
                    <span className="text-[13px] font-medium text-[#111113]">{fmtShort(r.period_start)} — {fmtShort(r.period_end)}</span>
                    <span className="text-[10px] text-[#9d9da8]">{getWeekLabel(getReportWeekDate(r, reportDay), currentWeekDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.content && <button onClick={e => { e.stopPropagation(); copy(r.content!) }} className="text-[10px] text-[#9d9da8] hover:text-[#111113] px-2 py-1 rounded hover:bg-[#f4f4f6]">Copy</button>}
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#c4c4cc" strokeWidth="2" strokeLinecap="round"><path d="M6 2l6 6-6 6" /></svg>
                  </div>
                </div>
                {r.content && <p className="text-[11px] text-[#9d9da8] mt-2 line-clamp-2">{r.content.replace(/\*\*/g, '').replace(/\n/g, ' ').slice(0, 250)}</p>}
                <div className="flex items-center gap-3 mt-2">
                  {r.generated_at && <span className="text-[10px] text-[#9d9da8]">Generated {fmtFull(r.generated_at)}</span>}
                  {r.sent_at && <span className="text-[10px] text-[#16a34a]">Sent {fmtFull(r.sent_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════ WEEK DETAIL ═══════════════════
  if (selectedWeek) {
    const weekReports = weeks.get(selectedWeek) || new Map()
    const sent = [...weekReports.values()].filter(r => r.status === 'sent').length
    const total = activeClients.length
    const draftOrReviewed = [...weekReports.values()].filter(r => r.status === 'draft' || r.status === 'reviewed')

    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <BackButton onClick={() => setSelectedWeek(null)} />
          <div>
            <h1 className="text-[20px] font-semibold text-[#111113] tracking-tight">{getWeekLabel(selectedWeek, currentWeekDate)}</h1>
            <p className="text-[12px] text-[#9d9da8] mt-0.5">{DAY_NAMES[reportDay]} {fmtShort(selectedWeek)} — {sent}/{total} sent</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-white border border-[#e8e8ec] rounded-md p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#111113]">{sent} of {total} reports sent</span>
            <div className="flex items-center gap-2">
              {draftOrReviewed.length > 0 && (
                <button
                  onClick={() => batchUpdateStatus(draftOrReviewed.map(r => r.id), 'sent')}
                  className="text-[10px] px-2.5 py-1 rounded font-medium text-[#16a34a] hover:bg-[#dcfce7] transition-colors"
                >
                  Mark All Sent ({draftOrReviewed.length})
                </button>
              )}
              <span className="text-[11px] text-[#9d9da8]">{total - weekReports.size} not generated</span>
            </div>
          </div>
          <div className="h-2 bg-[#f4f4f6] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${total > 0 ? (sent / total) * 100 : 0}%`, backgroundColor: sent === total ? '#16a34a' : '#2563eb' }} />
          </div>
          <div className="flex items-center gap-4 mt-2">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setSelectedDays(p.value)} className={`px-2 py-1 text-[10px] font-medium rounded ${selectedDays === p.value ? 'bg-[#111113] text-white' : 'bg-[#f4f4f6] text-[#6b6b76]'}`}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* All clients for this week */}
        <div className="space-y-1">
          {activeClients.map(client => {
            const report = weekReports.get(client.id)
            return (
              <div key={client.id} className="bg-white border border-[#e8e8ec] rounded-md flex items-center justify-between px-4 py-3 hover:bg-[#f9f9fb] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  {report ? <Badge status={report.status} /> : <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#fef2f2] text-[#dc2626]">Missing</span>}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#111113] truncate">{client.name}</p>
                    {report && <p className="text-[10px] text-[#9d9da8]">{fmtShort(report.period_start)} — {fmtShort(report.period_end)}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {report?.content && (
                    <button onClick={() => copy(report.content!)} className={`text-[10px] px-2 py-1 rounded transition-colors ${copyOk ? 'text-[#16a34a]' : 'text-[#9d9da8] hover:text-[#111113] hover:bg-[#f4f4f6]'}`}>Copy</button>
                  )}
                  {report && report.status !== 'sent' && (
                    <button onClick={() => updateStatus(report.id, 'sent')} className="text-[10px] px-2 py-1 rounded font-medium text-[#16a34a] hover:bg-[#dcfce7] transition-colors">Mark Sent</button>
                  )}
                  {report ? (
                    <button onClick={() => openEditor(report)} className="text-[10px] px-2 py-1 rounded text-[#2563eb] hover:bg-[#dbeafe] font-medium transition-colors">Edit</button>
                  ) : (
                    <button onClick={() => generateReport(client.id)} disabled={generatingId === client.id} className={`text-[10px] px-2.5 py-1 rounded font-medium transition-colors ${generatingId === client.id ? 'text-[#9d9da8]' : 'text-[#111113] bg-[#f4f4f6] hover:bg-[#e8e8ec]'}`}>
                      {generatingId === client.id ? '...' : `Generate ${selectedDays}d`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
          <p className="text-[12px] text-[#9d9da8] mt-0.5">Weekly {DAY_SHORT[reportDay]} reports — generate, edit, copy to Gmail, mark sent</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setSelectedDays(p.value)} className={`px-2.5 py-1.5 text-[11px] font-medium rounded ${selectedDays === p.value ? 'bg-[#111113] text-white' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'}`}>{p.label}</button>
          ))}
          <button onClick={generateAll} disabled={generating} className={`ml-1 px-4 py-1.5 text-[12px] font-semibold rounded ${generating ? 'bg-[#e8e8ec] text-[#9d9da8]' : 'bg-[#111113] text-white hover:bg-[#2a2a2e]'}`}>
            {generating ? 'Generating...' : 'Generate All'}
          </button>
        </div>
      </div>

      {/* Schedule indicator */}
      <div className="flex items-center gap-3 mb-4 px-3 py-2.5 rounded-md bg-[#f8f8fa] border border-[#e8e8ec]">
        <div className={`w-2 h-2 rounded-full ${reportSettings.report_auto_generate ? 'bg-[#16a34a]' : 'bg-[#d4d4d8]'}`} />
        <span className="text-[12px] text-[#6b6b76]">
          {reportSettings.report_auto_generate
            ? `Auto-generating ${DAY_NAMES[reportDay]}s at ${reportSettings.report_time} ${tz === 'America/Los_Angeles' ? 'PST' : tz === 'America/New_York' ? 'EST' : tz === 'America/Chicago' ? 'CST' : tz === 'America/Denver' ? 'MST' : 'UTC'}`
            : `Schedule: ${DAY_NAMES[reportDay]}s (auto-generate off)`
          }
        </span>
        <span className="text-[11px] text-[#9d9da8]">|</span>
        <span className="text-[11px] text-[#9d9da8]">{reportSettings.report_default_days}d default period</span>
        <Link href="/settings/reports" className="ml-auto text-[11px] text-[#2563eb] hover:underline font-medium">
          Settings
        </Link>
      </div>

      {/* This Week Banner */}
      <div className="bg-white border border-[#e8e8ec] rounded-md p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[14px] font-semibold text-[#111113]">This Week — {DAY_NAMES[reportDay]} {fmtShort(currentWeekDate)}</h2>
            <p className="text-[11px] text-[#9d9da8] mt-0.5">{cwSent} sent, {cwDraft} in progress, {cwMissing} not generated</p>
          </div>
          <button onClick={() => setSelectedWeek(currentWeekDate)} className="px-3 py-1.5 text-[11px] font-medium text-[#2563eb] hover:bg-[#dbeafe] rounded transition-colors">
            View All Clients
          </button>
        </div>
        <div className="h-3 bg-[#f4f4f6] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${activeClients.length > 0 ? (cwSent / activeClients.length) * 100 : 0}%`, backgroundColor: cwSent === activeClients.length ? '#16a34a' : cwSent > 0 ? '#2563eb' : '#e8e8ec' }} />
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#16a34a]" /> {cwSent} Sent</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2563eb]" /> {cwDraft} Draft/Reviewed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#dc2626]" /> {cwMissing} Missing</span>
        </div>
      </div>

      {/* Week history */}
      <div className="space-y-4">
        {sortedWeeks.map(([weekDate, weekMap]) => {
          const sent = [...weekMap.values()].filter(r => r.status === 'sent').length
          const total = weekMap.size
          const isCurrentWeek = weekDate === currentWeekDate

          return (
            <div key={weekDate}>
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setSelectedWeek(weekDate)} className="text-[13px] font-semibold text-[#111113] hover:text-[#2563eb] transition-colors">
                  {getWeekLabel(weekDate, currentWeekDate)}
                  <span className="text-[11px] font-normal text-[#9d9da8] ml-2">{sent}/{total} sent</span>
                </button>
                {isCurrentWeek && cwMissing > 0 && (
                  <span className="text-[10px] text-[#dc2626] font-medium">{cwMissing} missing</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {[...weekMap.entries()].sort((a, b) => a[1].client_name.localeCompare(b[1].client_name)).map(([clientId, report]) => (
                  <div key={clientId} onClick={() => openEditor(report)} className="bg-white border border-[#e8e8ec] rounded-md p-3 hover:border-[#2563eb]/30 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-medium text-[#111113] truncate">{report.client_name}</p>
                      <Badge status={report.status} />
                    </div>
                    <p className="text-[10px] text-[#9d9da8]">{fmtShort(report.period_start)} — {fmtShort(report.period_end)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {report.content && (
                        <button onClick={e => { e.stopPropagation(); copy(report.content!) }} className="text-[10px] text-[#9d9da8] hover:text-[#111113] px-1.5 py-0.5 rounded hover:bg-[#f4f4f6]">Copy</button>
                      )}
                      {report.status !== 'sent' && (
                        <button onClick={e => { e.stopPropagation(); updateStatus(report.id, 'sent') }} className="text-[10px] text-[#16a34a] hover:bg-[#dcfce7] px-1.5 py-0.5 rounded font-medium">Sent</button>
                      )}
                      <button onClick={e => { e.stopPropagation(); setClientView(clientId) }} className="text-[10px] text-[#9d9da8] hover:text-[#2563eb] px-1.5 py-0.5 rounded">History</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {sortedWeeks.length === 0 && (
        <div className="bg-white border border-[#e8e8ec] rounded-md p-12 text-center">
          <div className="w-12 h-12 rounded-md bg-[#f4f4f6] flex items-center justify-center mx-auto mb-4 text-[#9d9da8]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 13V9m5 4V7m5 6v-3"/></svg>
          </div>
          <h3 className="text-[14px] font-semibold text-[#111113]">No reports yet</h3>
          <p className="text-[12px] text-[#9d9da8] mt-1 max-w-sm mx-auto">Generate your first client reports using the period selector above, or enable auto-generation in report settings.</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={generateAll} disabled={generating} className="px-4 py-2 rounded-md bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] transition-colors">
              {generating ? 'Generating...' : 'Generate All Reports'}
            </button>
            <a href="/settings/reports" className="px-4 py-2 rounded-md bg-[#f4f4f6] text-[#6b6b76] text-[12px] font-medium hover:bg-[#e8e8ec] transition-colors">
              Report Settings
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
