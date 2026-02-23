'use client'

import { useState } from 'react'

export function ClientActions() {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const body = Object.fromEntries(form.entries())

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setShowForm(false)
      window.location.reload()
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to create client')
    }
    setSaving(false)
  }

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-xl bg-white text-zinc-900 text-sm font-semibold hover:bg-zinc-200 transition-colors">
        + Add Client
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">New Client</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input name="name" placeholder="Client name *" required className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500" />
          <input name="industry" placeholder="Industry" className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500" />
          <input name="website" placeholder="Website" className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500" />
          <div className="grid grid-cols-2 gap-3">
            <input name="monthly_retainer" type="number" step="0.01" placeholder="Monthly retainer ($)" className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500" />
            <input name="rev_share_pct" type="number" step="0.01" placeholder="Rev share (%)" className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500" />
          </div>
          <input name="primary_contact_name" placeholder="Primary contact name" className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500" />
          <input name="primary_contact_email" type="email" placeholder="Primary contact email" className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500" />
          <select name="status" defaultValue="active" className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500">
            <option value="active">Active</option>
            <option value="pipeline">Pipeline</option>
            <option value="inactive">Inactive</option>
          </select>
          <textarea name="notes" placeholder="Notes" rows={2} className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500 resize-none" />

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl bg-zinc-800 text-sm font-semibold hover:bg-zinc-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-white text-zinc-900 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50 transition-colors">
              {saving ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
