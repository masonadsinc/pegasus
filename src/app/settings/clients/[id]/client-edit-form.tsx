'use client'

import { useState, useEffect } from 'react'

const inputClass = "w-full px-3 py-2.5 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] transition-colors"
const labelClass = "text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1 block"
const sectionClass = "text-[13px] font-semibold text-[#111113] mb-4 pb-2 border-b border-[#e8e8ec]"

interface BrandColor {
  name: string
  hex: string
}

export function ClientEditForm({ client }: { client: any }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [brandColors, setBrandColors] = useState<BrandColor[]>([])
  const [styleGuide, setStyleGuide] = useState('')
  const [creativePrefs, setCreativePrefs] = useState('')
  const [hardRules, setHardRules] = useState('')
  const [visualTone, setVisualTone] = useState('')
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [savingAssets, setSavingAssets] = useState(false)
  const [assetsSaved, setAssetsSaved] = useState(false)

  useEffect(() => {
    loadBrandAssets()
  }, [])

  async function loadBrandAssets() {
    try {
      const res = await fetch(`/api/creative-studio/brand-assets?clientId=${client.id}`)
      const data = await res.json()
      if (data.assets) {
        setBrandColors(data.assets.brand_colors || [])
        setStyleGuide(data.assets.style_guide || '')
        setCreativePrefs(data.assets.creative_prefs || '')
        setHardRules(data.assets.hard_rules || '')
        setVisualTone(data.assets.visual_tone || '')
      }
    } catch {}
    setLoadingAssets(false)
  }

  function addColor() {
    setBrandColors(prev => [...prev, { name: '', hex: '#000000' }])
  }

  function removeColor(index: number) {
    setBrandColors(prev => prev.filter((_, i) => i !== index))
  }

  function updateColor(index: number, field: 'name' | 'hex', value: string) {
    setBrandColors(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  async function saveBrandAssets() {
    setSavingAssets(true)
    try {
      await fetch('/api/creative-studio/brand-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          brandColors,
          styleGuide,
          creativePrefs,
          hardRules,
          visualTone,
        }),
      })
      setAssetsSaved(true)
      setTimeout(() => setAssetsSaved(false), 2000)
    } catch {}
    setSavingAssets(false)
  }

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* General */}
      <div>
        <h3 className={sectionClass}>General</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Client Name</label>
              <input name="name" defaultValue={client.name} required className={inputClass} />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Industry</label>
              <input name="industry" defaultValue={client.industry || ''} placeholder="e.g. Healthcare, E-commerce" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Location</label>
              <input name="location" defaultValue={client.location || ''} placeholder="e.g. Miami, FL / Nationwide" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Website</label>
            <input name="website" defaultValue={client.website || ''} placeholder="https://..." className={inputClass} />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div>
        <h3 className={sectionClass}>Contact</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Contact Name</label>
              <input name="primary_contact_name" defaultValue={client.primary_contact_name || ''} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input name="primary_contact_email" type="email" defaultValue={client.primary_contact_email || ''} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input name="primary_contact_phone" defaultValue={client.primary_contact_phone || ''} placeholder="+1 (555) 000-0000" className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      {/* Billing & Contract */}
      <div>
        <h3 className={sectionClass}>Billing & Contract</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Monthly Retainer ($)</label>
              <input name="monthly_retainer" type="number" step="0.01" defaultValue={client.monthly_retainer || ''} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Rev Share (%)</label>
              <input name="rev_share_pct" type="number" step="0.01" defaultValue={client.rev_share_pct || ''} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Onboarding Date</label>
              <input name="onboarding_date" type="date" defaultValue={client.onboarding_date || ''} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Contract Start</label>
              <input name="contract_start" type="date" defaultValue={client.contract_start || ''} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Contract End</label>
              <input name="contract_end" type="date" defaultValue={client.contract_end || ''} className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      {/* AI Context */}
      <div>
        <h3 className={sectionClass}>AI Context</h3>
        <p className="text-[11px] text-[#9d9da8] -mt-2 mb-3">
          This information is used by Pegasus AI for analysis, reports, and recommendations.
        </p>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Business Description</label>
            <textarea name="business_description" defaultValue={client.business_description || ''} rows={2} placeholder="What does this client's business do? What makes them unique?" className={inputClass + ' resize-none'} />
          </div>
          <div>
            <label className={labelClass}>Offer / Service Being Advertised</label>
            <textarea name="offer_service" defaultValue={client.offer_service || ''} rows={2} placeholder="What specific offer or service are the ads promoting?" className={inputClass + ' resize-none'} />
          </div>
          <div>
            <label className={labelClass}>Target Audience</label>
            <textarea name="target_audience" defaultValue={client.target_audience || ''} rows={2} placeholder="Who are we trying to reach? Demographics, interests, pain points" className={inputClass + ' resize-none'} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Brand Voice / Tone</label>
              <input name="brand_voice" defaultValue={client.brand_voice || ''} placeholder="e.g. Professional, friendly, urgent" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Competitors</label>
              <input name="competitors" defaultValue={client.competitors || ''} placeholder="e.g. CompanyA, CompanyB" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>KPI Goals & Benchmarks</label>
            <textarea name="kpi_goals" defaultValue={client.kpi_goals || ''} rows={2} placeholder="e.g. 50 leads/week at $25 CPL, 3x ROAS on purchases" className={inputClass + ' resize-none'} />
          </div>
          <div>
            <label className={labelClass}>AI Notes</label>
            <textarea name="ai_notes" defaultValue={client.ai_notes || ''} rows={3} placeholder="Any extra context the AI should know — special instructions, things to watch for, seasonal patterns, etc." className={inputClass + ' resize-none'} />
          </div>
        </div>
      </div>

      {/* Brand Assets (Creative Studio) */}
      <div>
        <h3 className={sectionClass}>Brand Assets (Creative Studio)</h3>
        <p className="text-[11px] text-[#9d9da8] -mt-2 mb-3">
          Used by Creative Studio for generating on-brand ad creatives. These are saved separately from the main client form.
        </p>

        {loadingAssets ? (
          <div className="text-[12px] text-[#9d9da8] py-4">Loading brand assets...</div>
        ) : (
          <div className="space-y-4">
            {/* Brand Colors */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass}>Brand Colors</label>
                <button type="button" onClick={addColor} className="text-[11px] text-[#2563eb] hover:text-[#1d4ed8] font-medium transition-colors">
                  + Add Color
                </button>
              </div>
              {brandColors.length === 0 ? (
                <p className="text-[11px] text-[#9d9da8] italic">No brand colors set. Add colors for consistent creative generation.</p>
              ) : (
                <div className="space-y-2">
                  {brandColors.map((color, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={color.hex}
                        onChange={e => updateColor(i, 'hex', e.target.value)}
                        className="w-10 h-10 rounded border border-[#e8e8ec] cursor-pointer p-0.5"
                      />
                      <input
                        value={color.hex}
                        onChange={e => updateColor(i, 'hex', e.target.value)}
                        placeholder="#000000"
                        className="w-24 px-2 py-2 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[12px] text-[#111113] font-mono focus:outline-none focus:border-[#2563eb]"
                      />
                      <input
                        value={color.name}
                        onChange={e => updateColor(i, 'name', e.target.value)}
                        placeholder="e.g. Primary, Accent, CTA"
                        className="flex-1 px-3 py-2 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[12px] text-[#111113] focus:outline-none focus:border-[#2563eb]"
                      />
                      <button type="button" onClick={() => removeColor(i)} className="text-[#9d9da8] hover:text-[#dc2626] transition-colors p-1">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Visual Tone */}
            <div>
              <label className={labelClass}>Visual Tone</label>
              <input
                value={visualTone}
                onChange={e => setVisualTone(e.target.value)}
                placeholder="e.g. Cinematic & premium, Natural & candid, Bold & modern"
                className={inputClass}
              />
            </div>

            {/* Style Guide */}
            <div>
              <label className={labelClass}>Style Guide</label>
              <textarea
                value={styleGuide}
                onChange={e => setStyleGuide(e.target.value)}
                rows={4}
                placeholder="Photography direction, typography preferences, layout rules, lighting notes..."
                className={inputClass + ' resize-none'}
              />
            </div>

            {/* Creative Preferences */}
            <div>
              <label className={labelClass}>Creative Preferences (What Works / What Doesn't)</label>
              <textarea
                value={creativePrefs}
                onChange={e => setCreativePrefs(e.target.value)}
                rows={4}
                placeholder="What works: full-bleed application shots, natural lighting...&#10;What doesn't: white backgrounds, dramatic lighting, stock photo vibes..."
                className={inputClass + ' resize-none'}
              />
            </div>

            {/* Hard Rules */}
            <div>
              <label className={labelClass}>Hard Rules (Must Do / Must Not Do)</label>
              <textarea
                value={hardRules}
                onChange={e => setHardRules(e.target.value)}
                rows={3}
                placeholder="e.g. MUST use LLumar branding, MUST NOT include XPEL, NO faces in ads, NO logos"
                className={inputClass + ' resize-none'}
              />
            </div>

            <button
              type="button"
              onClick={saveBrandAssets}
              disabled={savingAssets}
              className="w-full py-2.5 rounded bg-[#111113] text-white text-[13px] font-medium hover:bg-[#2a2a2e] disabled:opacity-50 transition-colors"
            >
              {savingAssets ? 'Saving...' : assetsSaved ? 'Brand Assets Saved' : 'Save Brand Assets'}
            </button>
          </div>
        )}
      </div>

      {/* Internal Notes */}
      <div>
        <h3 className={sectionClass}>Internal Notes</h3>
        <textarea name="notes" defaultValue={client.notes || ''} rows={3} placeholder="Private notes about this client (not used by AI)" className={inputClass + ' resize-none'} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-[#e8e8ec]">
        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
        <button type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2.5 rounded border border-[#fecaca] text-[#dc2626] text-[13px] font-medium hover:bg-[#fef2f2] disabled:opacity-50 transition-colors">
          {deleting ? 'Deleting...' : 'Delete Client'}
        </button>
      </div>
    </form>
  )
}
