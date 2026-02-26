'use client'

import { useState } from 'react'

export function PortalManager({ clientId, initialToken }: { clientId: string; initialToken: string | null }) {
  const [token, setToken] = useState(initialToken)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const portalUrl = token ? `${window.location.origin}/portal/${token}` : null

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      const data = await res.json()
      if (data.token) setToken(data.token)
      else alert(data.error || 'Failed to generate')
    } catch { alert('Failed') }
    setLoading(false)
  }

  async function revoke() {
    if (!confirm('Revoke portal access? The client will no longer be able to view their dashboard.')) return
    setLoading(true)
    try {
      await fetch(`/api/portal?clientId=${clientId}`, { method: 'DELETE' })
      setToken(null)
    } catch { alert('Failed') }
    setLoading(false)
  }

  async function copyLink() {
    if (!portalUrl) return
    await navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <h3 className="text-[13px] font-semibold text-[#111113] mb-1">Client Portal</h3>
      <p className="text-[11px] text-[#9d9da8] mb-4">Share a read-only dashboard link with your client. No login required.</p>

      {token ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
            <span className="text-[12px] text-[#16a34a] font-medium">Portal active</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={portalUrl || ''}
              className="flex-1 px-3 py-2 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[12px] text-[#6b6b76] font-mono truncate"
            />
            <button
              onClick={copyLink}
              className={`px-3 py-2 rounded text-[11px] font-medium transition-colors shrink-0 ${
                copied ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'
              }`}
            >
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={generate} disabled={loading} className="px-3 py-2 rounded bg-[#f4f4f6] text-[11px] font-medium text-[#6b6b76] hover:bg-[#e8e8ec] disabled:opacity-50 transition-colors">
              Regenerate Link
            </button>
            <button onClick={revoke} disabled={loading} className="px-3 py-2 rounded border border-[#fecaca] text-[11px] font-medium text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50 transition-colors">
              Revoke Access
            </button>
          </div>
        </div>
      ) : (
        <button onClick={generate} disabled={loading} className="px-4 py-2.5 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
          {loading ? 'Generating...' : 'Generate Portal Link'}
        </button>
      )}
    </div>
  )
}
