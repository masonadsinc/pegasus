'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const FEATURE_LABELS: Record<string, string> = {
  'pegasus-chat': 'Pegasus Chat',
  'report-generation': 'Report Generation',
  'creative-analysis': 'Creative Analysis',
  'creative-studio-analysis': 'Creative Studio — Winner Analysis',
  'creative-studio-generation': 'Creative Studio — Image Generation',
  'creative-studio-qa': 'Creative Studio — QA Check',
  'creative-studio-summary': 'Creative Studio — Concept Summary',
}

const PERIOD_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '60d', value: 60 },
  { label: '90d', value: 90 },
]

interface UsageData {
  totalCost: number
  totalCalls: number
  totalTokens: number
  byFeature: Record<string, { calls: number; inputTokens: number; outputTokens: number; images: number; cost: number }>
  byModel: Record<string, { calls: number; cost: number }>
  byDay: Record<string, { calls: number; cost: number }>
  recentLogs: any[]
}

export function UsageDashboard() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    loadData()
  }, [days])

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/usage?days=${days}`)
      const d = await res.json()
      setData(d)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      {/* Breadcrumb */}
      <div className="text-[12px] text-[#9d9da8] mb-2">
        <Link href="/settings" className="hover:text-[#111113]">Settings</Link>
        <span className="mx-1.5">/</span>
        <span className="text-[#6b6b76]">API Usage</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-[#111113]">API Usage</h1>
          <p className="text-[12px] text-[#9d9da8] mt-0.5">Gemini API usage and estimated costs</p>
        </div>
        <div className="flex items-center border border-[#e8e8ec] rounded overflow-hidden">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-2.5 py-1 text-[11px] font-medium border-r border-[#e8e8ec] last:border-r-0 transition-colors ${
                days === opt.value ? 'bg-[#111113] text-white' : 'bg-white text-[#9d9da8] hover:text-[#111113]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-[13px] text-[#9d9da8] py-12 text-center">Loading usage data...</div>
      ) : !data ? (
        <div className="text-[13px] text-[#9d9da8] py-12 text-center">Failed to load usage data</div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-md bg-white border border-[#e8e8ec] p-5">
              <p className="text-[10px] text-[#9d9da8] font-semibold uppercase tracking-wider mb-1">Estimated Cost</p>
              <p className="text-[24px] font-semibold text-[#111113] tabular-nums">${data.totalCost.toFixed(4)}</p>
              <p className="text-[11px] text-[#9d9da8] mt-1">Last {days} days</p>
            </div>
            <div className="rounded-md bg-white border border-[#e8e8ec] p-5">
              <p className="text-[10px] text-[#9d9da8] font-semibold uppercase tracking-wider mb-1">API Calls</p>
              <p className="text-[24px] font-semibold text-[#111113] tabular-nums">{data.totalCalls.toLocaleString()}</p>
              <p className="text-[11px] text-[#9d9da8] mt-1">{(data.totalCalls / days).toFixed(1)}/day avg</p>
            </div>
            <div className="rounded-md bg-white border border-[#e8e8ec] p-5">
              <p className="text-[10px] text-[#9d9da8] font-semibold uppercase tracking-wider mb-1">Total Tokens</p>
              <p className="text-[24px] font-semibold text-[#111113] tabular-nums">{(data.totalTokens / 1000).toFixed(1)}K</p>
              <p className="text-[11px] text-[#9d9da8] mt-1">Input + output</p>
            </div>
          </div>

          {/* Usage by Feature */}
          <div className="rounded-md bg-white border border-[#e8e8ec] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e8e8ec]">
              <h2 className="text-[13px] font-semibold text-[#111113]">Usage by Feature</h2>
            </div>
            {Object.keys(data.byFeature).length === 0 ? (
              <div className="px-5 py-8 text-[13px] text-[#9d9da8] text-center">No usage recorded yet</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#f4f4f6]">
                    <th className="text-left px-5 py-2 text-[10px] text-[#9d9da8] font-semibold uppercase tracking-wider">Feature</th>
                    <th className="text-right px-5 py-2 text-[10px] text-[#9d9da8] font-semibold uppercase tracking-wider">Calls</th>
                    <th className="text-right px-5 py-2 text-[10px] text-[#9d9da8] font-semibold uppercase tracking-wider">Input Tokens</th>
                    <th className="text-right px-5 py-2 text-[10px] text-[#9d9da8] font-semibold uppercase tracking-wider">Output Tokens</th>
                    <th className="text-right px-5 py-2 text-[10px] text-[#9d9da8] font-semibold uppercase tracking-wider">Images</th>
                    <th className="text-right px-5 py-2 text-[10px] text-[#9d9da8] font-semibold uppercase tracking-wider">Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.byFeature)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .map(([feature, stats]) => (
                      <tr key={feature} className="border-b border-[#f4f4f6] last:border-b-0">
                        <td className="px-5 py-3 text-[13px] text-[#111113]">{FEATURE_LABELS[feature] || feature}</td>
                        <td className="px-5 py-3 text-[13px] text-[#111113] text-right tabular-nums">{stats.calls}</td>
                        <td className="px-5 py-3 text-[13px] text-[#9d9da8] text-right tabular-nums">{stats.inputTokens.toLocaleString()}</td>
                        <td className="px-5 py-3 text-[13px] text-[#9d9da8] text-right tabular-nums">{stats.outputTokens.toLocaleString()}</td>
                        <td className="px-5 py-3 text-[13px] text-[#9d9da8] text-right tabular-nums">{stats.images || '—'}</td>
                        <td className="px-5 py-3 text-[13px] font-semibold text-[#111113] text-right tabular-nums">${stats.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Usage by Model */}
          <div className="rounded-md bg-white border border-[#e8e8ec] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e8e8ec]">
              <h2 className="text-[13px] font-semibold text-[#111113]">Usage by Model</h2>
            </div>
            {Object.keys(data.byModel).length === 0 ? (
              <div className="px-5 py-8 text-[13px] text-[#9d9da8] text-center">No usage recorded yet</div>
            ) : (
              <div className="divide-y divide-[#f4f4f6]">
                {Object.entries(data.byModel)
                  .sort((a, b) => b[1].cost - a[1].cost)
                  .map(([model, stats]) => (
                    <div key={model} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-[13px] text-[#111113] font-mono">{model}</p>
                        <p className="text-[11px] text-[#9d9da8]">{stats.calls} calls</p>
                      </div>
                      <p className="text-[13px] font-semibold text-[#111113] tabular-nums">${stats.cost.toFixed(4)}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded-md bg-white border border-[#e8e8ec] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e8e8ec]">
              <h2 className="text-[13px] font-semibold text-[#111113]">Recent API Calls</h2>
            </div>
            {data.recentLogs.length === 0 ? (
              <div className="px-5 py-8 text-[13px] text-[#9d9da8] text-center">No API calls recorded yet. Usage will appear here as you use Pegasus, Reports, and Creative Studio.</div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto divide-y divide-[#f4f4f6]">
                {data.recentLogs.map((log: any) => (
                  <div key={log.id} className="px-5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[11px] text-[#9d9da8] flex-shrink-0 w-[110px]">
                        {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <span className="text-[12px] text-[#111113] truncate">{FEATURE_LABELS[log.feature] || log.feature}</span>
                      <span className="text-[10px] text-[#9d9da8] font-mono flex-shrink-0">{log.model}</span>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="text-[11px] text-[#9d9da8] tabular-nums">{((log.input_tokens || 0) + (log.output_tokens || 0)).toLocaleString()} tok</span>
                      {log.images_generated > 0 && <span className="text-[11px] text-[#9d9da8]">{log.images_generated} img</span>}
                      <span className="text-[12px] font-semibold text-[#111113] tabular-nums w-[70px] text-right">${parseFloat(log.estimated_cost || 0).toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
