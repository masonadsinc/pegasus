'use client'

import { useState } from 'react'

const inputClass = "w-full px-4 py-2.5 rounded-lg bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] focus:outline-none focus:border-[#2563eb] transition-colors"

export function TeamActions() {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const body = Object.fromEntries(form.entries())
    const res = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { setShowForm(false); window.location.reload() }
    else { const err = await res.json(); alert(err.error || 'Failed to invite') }
    setSaving(false)
  }

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] transition-colors">
        Invite Member
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#e8e8ec] rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-bold text-[#111113] mb-4">Invite Team Member</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input name="email" type="email" placeholder="Email address *" required className={inputClass} />
          <input name="display_name" placeholder="Display name" className={inputClass} />
          <select name="role" defaultValue="operator" className={inputClass}>
            <option value="admin">Admin</option>
            <option value="operator">Operator</option>
            <option value="viewer">Viewer</option>
          </select>
          <input name="password" type="password" placeholder="Temporary password *" required className={inputClass} />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-[#f4f4f6] text-[13px] font-medium hover:bg-[#e8e8ec] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
              {saving ? 'Inviting...' : 'Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
