'use client'

import { useState } from 'react'

export function TeamActions() {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const body = Object.fromEntries(form.entries())

    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setShowForm(false)
      window.location.reload()
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to invite')
    }
    setSaving(false)
  }

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-xl bg-white text-zinc-900 text-sm font-semibold hover:bg-zinc-200 transition-colors">
        + Invite Member
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4">Invite Team Member</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input name="email" type="email" placeholder="Email address *" required className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500" />
          <input name="display_name" placeholder="Display name" className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500" />
          <select name="role" defaultValue="operator" className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500">
            <option value="admin">Admin</option>
            <option value="operator">Operator</option>
            <option value="viewer">Viewer</option>
          </select>
          <input name="password" type="password" placeholder="Temporary password *" required className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500" />

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl bg-zinc-800 text-sm font-semibold hover:bg-zinc-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-white text-zinc-900 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50 transition-colors">
              {saving ? 'Inviting...' : 'Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
