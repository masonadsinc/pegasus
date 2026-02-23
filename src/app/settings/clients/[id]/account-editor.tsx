'use client'

import { useState } from 'react'

const ACTION_TYPES = [
  { value: 'lead', label: 'Lead' },
  { value: 'omni_purchase', label: 'Purchase (Omni)' },
  { value: 'schedule_total', label: 'Schedule (Total)' },
  { value: 'offsite_conversion.fb_pixel_custom', label: 'Custom Pixel (Generic)' },
  { value: 'offsite_conversion.fb_pixel_custom.Hyros Call', label: 'Hyros Call' },
  { value: 'offsite_conversion.fb_pixel_lead', label: 'Pixel Lead' },
  { value: 'offsite_conversion.fb_pixel_purchase', label: 'Pixel Purchase' },
  { value: 'schedule_website', label: 'Schedule (Website)' },
]

const OBJECTIVES = [
  { value: 'leads', label: 'Leads' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'awareness', label: 'Awareness' },
]

const inputClass = "w-full px-3 py-2 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] transition-colors"
const labelClass = "text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1 block"

export function AccountEditor({ account }: { account: any }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [customAction, setCustomAction] = useState(
    !ACTION_TYPES.find(a => a.value === account.primary_action_type) && account.primary_action_type ? account.primary_action_type : ''
  )
  const [selectedAction, setSelectedAction] = useState(
    ACTION_TYPES.find(a => a.value === account.primary_action_type) ? account.primary_action_type : 'custom'
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const body: any = Object.fromEntries(form.entries())

    if (body.primary_action_type === 'custom') {
      body.primary_action_type = customAction
    }

    if (body.target_cpl === '') delete body.target_cpl
    if (body.target_roas === '') delete body.target_roas

    const res = await fetch(`/api/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to save')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-medium text-[#111113]">{account.name}</h3>
          <p className="text-[11px] text-[#9d9da8]">act_{account.platform_account_id}</p>
        </div>
        <span className={`w-2 h-2 rounded-full ${account.is_active ? 'bg-[#16a34a]' : 'bg-[#9d9da8]'}`} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Objective</label>
          <select name="objective" defaultValue={account.objective || ''} className={inputClass}>
            {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Action Type</label>
          <select
            name="primary_action_type"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className={inputClass}
          >
            {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            <option value="custom">Custom...</option>
          </select>
        </div>
      </div>

      {selectedAction === 'custom' && (
        <div>
          <label className={labelClass}>Custom Action Type</label>
          <input
            value={customAction}
            onChange={(e) => setCustomAction(e.target.value)}
            placeholder="e.g. offsite_conversion.fb_pixel_custom.My Event"
            className={inputClass}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Target CPL ($)</label>
          <input name="target_cpl" type="number" step="0.01" defaultValue={account.target_cpl || ''} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Target ROAS (x)</label>
          <input name="target_roas" type="number" step="0.01" defaultValue={account.target_roas || ''} className={inputClass} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] text-[#6b6b76]">
          <input name="is_active" type="checkbox" defaultChecked={account.is_active} className="rounded" />
          Active
        </label>
        <div className="flex-1" />
        <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {account.last_synced_at && (
        <p className="text-[11px] text-[#9d9da8]">Last synced: {new Date(account.last_synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
      )}
    </form>
  )
}
