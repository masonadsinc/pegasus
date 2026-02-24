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

export function GeminiKeyForm({ hasKey, maskedKey }: { hasKey: boolean; maskedKey: string }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [keyConfigured, setKeyConfigured] = useState(hasKey)
  const [displayMask, setDisplayMask] = useState(maskedKey)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const key = form.get('gemini_api_key') as string

    if (!key) {
      setSaving(false)
      return
    }

    const res = await fetch('/api/agency', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gemini_api_key: key }),
    })

    if (res.ok) {
      setSaved(true)
      setKeyConfigured(true)
      setDisplayMask(key.slice(0, 4) + '****' + key.slice(-4))
      // Clear the input after save
      const input = e.currentTarget.querySelector('input[name="gemini_api_key"]') as HTMLInputElement
      if (input) input.value = ''
      setTimeout(() => setSaved(false), 2000)
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to save')
    }
    setSaving(false)
  }

  async function handleRemove() {
    if (!confirm('Remove the Gemini API key? Pegasus AI will stop working.')) return
    setSaving(true)
    const res = await fetch('/api/agency', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gemini_api_key: '' }),
    })
    if (res.ok) {
      setKeyConfigured(false)
      setDisplayMask('')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Google Gemini API Key</label>
        {keyConfigured && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-[#f0fdf4] border border-[#bbf7d0] rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
            <span className="text-[12px] text-[#16a34a] font-medium">Key configured</span>
            <span className="text-[12px] text-[#9d9da8] font-mono ml-auto">{displayMask}</span>
          </div>
        )}
        <input
          name="gemini_api_key"
          type="password"
          placeholder={keyConfigured ? 'Enter new key to replace' : 'Enter your Gemini API key'}
          className={inputClass}
          autoComplete="off"
        />
        <p className="text-[11px] text-[#9d9da8] mt-1.5">
          Powers the Pegasus AI assistant. Get a key from{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[#2563eb] hover:underline">
            Google AI Studio
          </a>
          . Keys are encrypted at rest and never displayed after saving.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="px-4 py-2.5 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : saved ? 'Saved' : keyConfigured ? 'Update Key' : 'Save Key'}
        </button>
        {keyConfigured && (
          <button type="button" onClick={handleRemove} disabled={saving} className="px-4 py-2.5 rounded border border-[#fecaca] text-[#dc2626] text-[12px] font-medium hover:bg-[#fef2f2] disabled:opacity-50 transition-colors">
            Remove Key
          </button>
        )}
      </div>
    </form>
  )
}
