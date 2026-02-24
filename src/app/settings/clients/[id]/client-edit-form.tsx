'use client'

import { useState } from 'react'

const inputClass = "w-full px-3 py-2.5 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] transition-colors"
const labelClass = "text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1 block"
const sectionClass = "text-[13px] font-semibold text-[#111113] mb-4 pb-2 border-b border-[#e8e8ec]"

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
