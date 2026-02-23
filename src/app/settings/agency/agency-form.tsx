'use client'

import { useState } from 'react'

const inputClass = "w-full px-3 py-2.5 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] transition-colors"
const labelClass = "text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1 block"

export function AgencyForm({ org }: { org: any }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const body = Object.fromEntries(form.entries())

    const res = await fetch('/api/agency', {
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Agency Name</label>
        <input name="name" defaultValue={org?.name || ''} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Logo URL</label>
        <input name="logo_url" defaultValue={org?.logo_url || ''} placeholder="https://..." className={inputClass} />
        {org?.logo_url && (
          <div className="mt-2 p-3 bg-[#f8f8fa] rounded border border-[#e8e8ec]">
            <img src={org.logo_url} alt="Logo" className="h-8 object-contain" />
          </div>
        )}
      </div>
      <div>
        <label className={labelClass}>Brand Color</label>
        <div className="flex items-center gap-3">
          <input name="primary_color" type="color" defaultValue={org?.primary_color || '#2563eb'} className="w-10 h-10 rounded border border-[#e8e8ec] cursor-pointer" />
          <input defaultValue={org?.primary_color || '#2563eb'} disabled className={inputClass + ' flex-1 opacity-60'} />
        </div>
      </div>

      <button type="submit" disabled={saving} className="w-full py-2.5 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save Branding'}
      </button>
    </form>
  )
}
