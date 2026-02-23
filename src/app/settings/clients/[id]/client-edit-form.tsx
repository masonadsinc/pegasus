'use client'

import { useState } from 'react'

export function ClientEditForm({ client }: { client: any }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  const inputClass = "w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500"

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Name</label>
        <input name="name" defaultValue={client.name} required className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Industry</label>
          <input name="industry" defaultValue={client.industry || ''} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Status</label>
          <select name="status" defaultValue={client.status} className={inputClass}>
            <option value="active">Active</option>
            <option value="pipeline">Pipeline</option>
            <option value="inactive">Inactive</option>
            <option value="churned">Churned</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Website</label>
        <input name="website" defaultValue={client.website || ''} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Monthly Retainer</label>
          <input name="monthly_retainer" type="number" step="0.01" defaultValue={client.monthly_retainer || ''} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Rev Share %</label>
          <input name="rev_share_pct" type="number" step="0.01" defaultValue={client.rev_share_pct || ''} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Contact Name</label>
          <input name="primary_contact_name" defaultValue={client.primary_contact_name || ''} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Contact Email</label>
          <input name="primary_contact_email" type="email" defaultValue={client.primary_contact_email || ''} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Notes</label>
        <textarea name="notes" defaultValue={client.notes || ''} rows={3} className={inputClass + ' resize-none'} />
      </div>

      <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg bg-white text-zinc-900 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50 transition-colors">
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
      </button>
    </form>
  )
}
