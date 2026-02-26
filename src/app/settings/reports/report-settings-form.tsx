'use client'

import { useState } from 'react'
import Link from 'next/link'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PERIOD_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
]
const inputClass = "w-full px-3 py-2.5 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] transition-colors"
const labelClass = "text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1 block"
const selectClass = "w-full px-3 py-2.5 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] transition-colors appearance-none cursor-pointer"

interface Override {
  id: string
  client_id: string
  report_day: number | null
  report_time: string | null
  period_days: number | null
  enabled: boolean
}

interface Props {
  initialSettings: {
    report_day: number
    report_time: string
    report_auto_generate: boolean
    report_default_days: number
    report_timezone: string // from org.timezone
  }
  clients: { id: string; name: string }[]
  initialOverrides: Override[]
}

export function ReportSettingsForm({ initialSettings, clients, initialOverrides }: Props) {
  const [settings, setSettings] = useState(initialSettings)
  const [overrides, setOverrides] = useState<Override[]>(initialOverrides)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [addingOverride, setAddingOverride] = useState(false)
  const [newClientId, setNewClientId] = useState('')

  async function saveSettings() {
    setSaving(true)
    try {
      const res = await fetch('/api/report-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to save')
      }
    } catch { alert('Failed to save') }
    setSaving(false)
  }

  async function saveOverride(o: Partial<Override> & { client_id: string }) {
    try {
      const res = await fetch('/api/report-settings/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(o),
      })
      if (res.ok) {
        const data = await res.json()
        setOverrides(prev => {
          const idx = prev.findIndex(p => p.client_id === o.client_id)
          if (idx >= 0) { const next = [...prev]; next[idx] = data; return next }
          return [...prev, data]
        })
      }
    } catch {}
  }

  async function removeOverride(clientId: string) {
    try {
      await fetch(`/api/report-settings/overrides?clientId=${clientId}`, { method: 'DELETE' })
      setOverrides(prev => prev.filter(o => o.client_id !== clientId))
    } catch {}
  }

  const clientsWithoutOverride = clients.filter(c => !overrides.find(o => o.client_id === c.id))

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="text-[#9d9da8] hover:text-[#111113]">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2L4 8l6 6" /></svg>
        </Link>
        <div>
          <h1 className="text-[20px] font-semibold text-[#111113] tracking-tight">Report Settings</h1>
          <p className="text-[12px] text-[#9d9da8] mt-0.5">Configure when reports are generated and delivered</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Global Settings */}
        <div className="bg-white border border-[#e8e8ec] rounded-md">
          <div className="px-5 py-4 border-b border-[#e8e8ec]">
            <h2 className="text-[14px] font-semibold text-[#111113]">Schedule</h2>
            <p className="text-[11px] text-[#9d9da8] mt-0.5">Default schedule for all clients</p>
          </div>
          <div className="p-5 space-y-4">
            {/* Auto-generate toggle */}
            <div className="flex items-center justify-between p-3 rounded bg-[#f8f8fa] border border-[#e8e8ec]">
              <div>
                <p className="text-[13px] font-medium text-[#111113]">Auto-generate reports</p>
                <p className="text-[11px] text-[#9d9da8] mt-0.5">Automatically generate reports on schedule</p>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, report_auto_generate: !s.report_auto_generate }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.report_auto_generate ? 'bg-[#2563eb]' : 'bg-[#d4d4d8]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.report_auto_generate ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {/* Report day */}
            <div>
              <label className={labelClass}>Report Day</label>
              <select
                value={settings.report_day}
                onChange={e => setSettings(s => ({ ...s, report_day: parseInt(e.target.value) }))}
                className={selectClass}
              >
                {DAY_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>

            {/* Report time */}
            <div>
              <label className={labelClass}>Generation Time</label>
              <input
                type="time"
                value={settings.report_time}
                onChange={e => setSettings(s => ({ ...s, report_time: e.target.value }))}
                className={inputClass}
              />
              <p className="text-[10px] text-[#9d9da8] mt-1">Reports will be auto-generated at this time</p>
            </div>

            {/* Default period */}
            <div>
              <label className={labelClass}>Default Report Period</label>
              <div className="flex gap-2">
                {PERIOD_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, report_default_days: p.value }))}
                    className={`px-3 py-2 text-[12px] font-medium rounded transition-colors ${
                      settings.report_default_days === p.value
                        ? 'bg-[#111113] text-white'
                        : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full py-2.5 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Per-client overrides */}
        <div className="bg-white border border-[#e8e8ec] rounded-md">
          <div className="px-5 py-4 border-b border-[#e8e8ec] flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-[#111113]">Client Overrides</h2>
              <p className="text-[11px] text-[#9d9da8] mt-0.5">Custom schedules per client</p>
            </div>
            {!addingOverride && clientsWithoutOverride.length > 0 && (
              <button
                onClick={() => { setAddingOverride(true); setNewClientId(clientsWithoutOverride[0]?.id || '') }}
                className="px-3 py-1.5 text-[11px] font-medium text-[#2563eb] hover:bg-[#dbeafe] rounded transition-colors"
              >
                + Add Override
              </button>
            )}
          </div>
          <div className="p-5">
            {/* Add new override */}
            {addingOverride && (
              <div className="p-3 border border-[#2563eb]/20 rounded-md bg-[#f8faff] mb-4 space-y-3">
                <div>
                  <label className={labelClass}>Client</label>
                  <select value={newClientId} onChange={e => setNewClientId(e.target.value)} className={selectClass}>
                    {clientsWithoutOverride.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (newClientId) {
                        saveOverride({ client_id: newClientId, enabled: true })
                        setAddingOverride(false)
                      }
                    }}
                    className="px-3 py-1.5 text-[11px] font-medium bg-[#2563eb] text-white rounded hover:bg-[#1d4ed8]"
                  >
                    Add
                  </button>
                  <button onClick={() => setAddingOverride(false)} className="px-3 py-1.5 text-[11px] font-medium text-[#6b6b76] hover:bg-[#f4f4f6] rounded">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {overrides.length === 0 && !addingOverride ? (
              <div className="text-center py-8">
                <p className="text-[13px] text-[#6b6b76]">No client overrides</p>
                <p className="text-[11px] text-[#9d9da8] mt-1">All clients use the default schedule</p>
              </div>
            ) : (
              <div className="space-y-2">
                {overrides.map(o => {
                  const client = clients.find(c => c.id === o.client_id)
                  return (
                    <div key={o.id} className="p-3 border border-[#e8e8ec] rounded-md hover:bg-[#f9f9fb] transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[#111113]">{client?.name || 'Unknown'}</span>
                          {!o.enabled && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-[#fef2f2] text-[#dc2626]">Disabled</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => saveOverride({ ...o, enabled: !o.enabled })}
                            className={`px-2 py-1 text-[10px] rounded font-medium transition-colors ${
                              o.enabled ? 'text-[#dc2626] hover:bg-[#fef2f2]' : 'text-[#16a34a] hover:bg-[#dcfce7]'
                            }`}
                          >
                            {o.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => removeOverride(o.client_id)}
                            className="px-2 py-1 text-[10px] text-[#9d9da8] hover:text-[#dc2626] rounded hover:bg-[#fef2f2]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] text-[#9d9da8] uppercase tracking-wider">Day</label>
                          <select
                            value={o.report_day ?? ''}
                            onChange={e => saveOverride({ ...o, report_day: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full px-2 py-1.5 rounded bg-[#f4f4f6] border border-[#e8e8ec] text-[11px] text-[#111113]"
                          >
                            <option value="">Default</option>
                            {DAY_NAMES.map((name, i) => (
                              <option key={i} value={i}>{name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-[#9d9da8] uppercase tracking-wider">Time</label>
                          <input
                            type="time"
                            value={o.report_time || ''}
                            onChange={e => saveOverride({ ...o, report_time: e.target.value || null })}
                            className="w-full px-2 py-1.5 rounded bg-[#f4f4f6] border border-[#e8e8ec] text-[11px] text-[#111113]"
                            placeholder="Default"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-[#9d9da8] uppercase tracking-wider">Period</label>
                          <select
                            value={o.period_days ?? ''}
                            onChange={e => saveOverride({ ...o, period_days: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full px-2 py-1.5 rounded bg-[#f4f4f6] border border-[#e8e8ec] text-[11px] text-[#111113]"
                          >
                            <option value="">Default</option>
                            {PERIOD_OPTIONS.map(p => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule preview */}
      <div className="bg-white border border-[#e8e8ec] rounded-md mt-6">
        <div className="px-5 py-4 border-b border-[#e8e8ec]">
          <h2 className="text-[14px] font-semibold text-[#111113]">Schedule Preview</h2>
          <p className="text-[11px] text-[#9d9da8] mt-0.5">When each client's report will be generated</p>
        </div>
        <div className="p-5">
          <div className="space-y-1">
            {clients.map(c => {
              const override = overrides.find(o => o.client_id === c.id)
              const day = override?.report_day ?? settings.report_day
              const time = override?.report_time || settings.report_time
              const period = override?.period_days || settings.report_default_days
              const disabled = override?.enabled === false

              return (
                <div key={c.id} className={`flex items-center justify-between px-3 py-2 rounded text-[12px] ${disabled ? 'opacity-40' : 'hover:bg-[#f9f9fb]'}`}>
                  <span className={`font-medium ${disabled ? 'line-through text-[#9d9da8]' : 'text-[#111113]'}`}>{c.name}</span>
                  <div className="flex items-center gap-3 text-[11px] text-[#9d9da8]">
                    {disabled ? (
                      <span className="text-[#dc2626]">Disabled</span>
                    ) : (
                      <>
                        <span>{DAY_NAMES[day]}s at {time}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#f4f4f6] text-[10px] font-medium">{period}d</span>
                        {override && <span className="px-1.5 py-0.5 rounded bg-[#dbeafe] text-[#2563eb] text-[10px] font-medium">Custom</span>}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
