'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'

interface SettingsTabProps {
  clientId?: string
  clientName?: string
  platformAccountId?: string
  objective?: string
  primaryActionType?: string | null
  resultLabel: string
  isEcom: boolean
  targetCpl: number | null
  targetRoas: number | null
  initialPortalToken: string | null
  dailyCount: number
  campaignCount: number
  adCount: number
  hasBreakdownData: boolean
}

export function SettingsTab({
  clientId, clientName, platformAccountId, objective, primaryActionType,
  resultLabel, isEcom, targetCpl, targetRoas, initialPortalToken,
  dailyCount, campaignCount, adCount, hasBreakdownData,
}: SettingsTabProps) {
  const [portalToken, setPortalToken] = useState<string | null>(initialPortalToken)
  const [portalLoading, setPortalLoading] = useState(false)

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="p-5">
        <h3 className="text-[13px] font-semibold mb-4">Account Configuration</h3>
        <div className="space-y-3 text-[13px]">
          <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
            <span className="text-[#9d9da8]">Account Name</span>
            <span className="font-medium">{clientName || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
            <span className="text-[#9d9da8]">Platform Account ID</span>
            <span className="font-mono text-[12px]">{platformAccountId || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
            <span className="text-[#9d9da8]">Objective</span>
            <span className="font-medium capitalize">{objective || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
            <span className="text-[#9d9da8]">Primary Action Type</span>
            <span className="font-mono text-[12px]">{primaryActionType || 'lead'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
            <span className="text-[#9d9da8]">Result Label</span>
            <span className="font-medium">{resultLabel}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
            <span className="text-[#9d9da8]">{isEcom ? 'Target ROAS' : 'Target CPR'}</span>
            <span className="font-semibold">{isEcom ? (targetRoas ? `${targetRoas}x` : '—') : (targetCpl ? formatCurrency(targetCpl) : '—')}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[#9d9da8]">Account Type</span>
            <Badge variant={isEcom ? 'info' : 'success'}>{isEcom ? 'E-commerce' : 'Lead Gen'}</Badge>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-[13px] font-semibold mb-4">Client Portal</h3>
        <p className="text-[12px] text-[#9d9da8] mb-3">Generate a shareable link for your client to view their dashboard — no login required.</p>
        <div className="space-y-3">
          {portalToken ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${portalToken}`}
                  className="flex-1 px-3 py-2 border border-[#e8e8ec] rounded text-[12px] text-[#111113] bg-[#f8f8fa] font-mono"
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal/${portalToken}`); }}
                  className="px-3 py-2 rounded border border-[#e8e8ec] text-[12px] font-medium text-[#111113] hover:bg-[#f8f8fa]"
                >
                  Copy
                </button>
              </div>
              <button
                onClick={async () => {
                  if (!confirm('This will invalidate the current link. Continue?')) return
                  setPortalLoading(true)
                  const res = await fetch('/api/portal', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }) })
                  if (res.ok) setPortalToken(null)
                  setPortalLoading(false)
                }}
                className="text-[11px] text-[#dc2626] hover:underline"
              >
                Revoke link
              </button>
            </div>
          ) : (
            <button
              onClick={async () => {
                setPortalLoading(true)
                const res = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }) })
                const data = await res.json()
                if (data.token) setPortalToken(data.token)
                setPortalLoading(false)
              }}
              disabled={portalLoading}
              className="px-4 py-2 rounded bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {portalLoading ? 'Generating...' : 'Generate Portal Link'}
            </button>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-[13px] font-semibold mb-4">Data Summary</h3>
        <div className="space-y-3 text-[13px]">
          <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
            <span className="text-[#9d9da8]">Data Range</span>
            <span className="font-medium">Last 30 days</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
            <span className="text-[#9d9da8]">Total Days with Data</span>
            <span className="font-medium">{dailyCount}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
            <span className="text-[#9d9da8]">Active Campaigns</span>
            <span className="font-medium">{campaignCount}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
            <span className="text-[#9d9da8]">Active Ads</span>
            <span className="font-medium">{adCount}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[#9d9da8]">Breakdown Data</span>
            <span className="font-medium">{hasBreakdownData ? 'Available' : 'None'}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
