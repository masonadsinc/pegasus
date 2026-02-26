'use client'

import { useState } from 'react'

const inputClass = "w-full px-3 py-2.5 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] transition-colors"
const labelClass = "text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1 block"

export function SyncSettings({ initialEnabled, initialTime, tzLabel }: { initialEnabled: boolean; initialTime: string; tzLabel: string }) {
  const [syncEnabled, setSyncEnabled] = useState(initialEnabled)
  const [syncTime, setSyncTime] = useState(initialTime)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/agency', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_enabled: syncEnabled, sync_time: syncTime }),
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 rounded bg-[#f8f8fa] border border-[#e8e8ec]">
        <div>
          <p className="text-[13px] font-medium text-[#111113]">Auto-sync</p>
          <p className="text-[10px] text-[#9d9da8] mt-0.5">Pull latest data from Meta daily</p>
        </div>
        <button
          onClick={() => setSyncEnabled(!syncEnabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${syncEnabled ? 'bg-[#2563eb]' : 'bg-[#d4d4d8]'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${syncEnabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <div>
        <label className={labelClass}>Sync Time ({tzLabel})</label>
        <input
          type="time"
          value={syncTime}
          onChange={e => setSyncTime(e.target.value)}
          className={inputClass}
        />
        <p className="text-[10px] text-[#9d9da8] mt-1">Recommended: 12:00 AM — 4:00 AM for complete previous-day data.</p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
      </button>
    </div>
  )
}
