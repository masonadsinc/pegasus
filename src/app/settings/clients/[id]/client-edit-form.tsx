'use client'

import { useState } from 'react'

const inputClass = "w-full px-3 py-2.5 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] transition-colors"
const labelClass = "text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1 block"

export function ClientEditForm({ client }: { client: any }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const body = Object.fromEntries(form.entries())

    const res = await fetch(`/api/clients/${client.id}`, {
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

  async function handleDelete() {
    if (!confirm(`Delete "${client.name}"? This cannot be undone.`)) return
    setDeleting(true)
    const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    if (res.ok) {
      window.location.href = '/settings/clients'
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to delete')
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={labelClass}>Name</label>
        <input name="name" defaultValue={client.name} required className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Industry</label>
          <input name="industry" defaultValue={client.industry || ''} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select name="status" defaultValue={client.status} className={inputClass}>
            <option value="active">Active</option>
            <option value="pipeline">Pipeline</option>
            <option value="inactive">Inactive</option>
            <option value="churned">Churned</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Website</label>
        <input name="website" defaultValue={client.website || ''} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Monthly Retainer ($)</label>
          <input name="monthly_retainer" type="number" step="0.01" defaultValue={client.monthly_retainer || ''} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Rev Share (%)</label>
          <input name="rev_share_pct" type="number" step="0.01" defaultValue={client.rev_share_pct || ''} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Contract Start</label>
          <input name="contract_start" type="date" defaultValue={client.contract_start || ''} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Contract End</label>
          <input name="contract_end" type="date" defaultValue={client.contract_end || ''} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Contact Name</label>
          <input name="primary_contact_name" defaultValue={client.primary_contact_name || ''} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Contact Email</label>
          <input name="primary_contact_email" type="email" defaultValue={client.primary_contact_email || ''} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <textarea name="notes" defaultValue={client.notes || ''} rows={3} className={inputClass + ' resize-none'} />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
        <button type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2.5 rounded border border-[#fecaca] text-[#dc2626] text-[13px] font-medium hover:bg-[#fef2f2] disabled:opacity-50 transition-colors">
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </form>
  )
}
