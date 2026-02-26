'use client'

import { Card } from '@/components/ui/card'
import { formatCurrency, formatNumber, formatPercent, formatCompact } from '@/lib/utils'
import { DataTable } from './shared'

interface PlacementsTabProps {
  placement: any[]
  resultLabel: string
  targetCpl: number | null
  totalSpend: number
}

export function PlacementsTab({ placement, resultLabel, targetCpl, totalSpend }: PlacementsTabProps) {
  const placementTotal = { spend: 0, results: 0 }
  placement.forEach((p: any) => { placementTotal.spend += p.spend; placementTotal.results += p.results })
  const bestPlacement = [...placement].filter((p: any) => p.results > 0).sort((a: any, b: any) => a.cpr - b.cpr)[0]
  const topPlacements = [...placement].filter((p: any) => p.results > 0).sort((a: any, b: any) => a.cpr - b.cpr).slice(0, 5)
  const worstPlacements = [...placement].filter((p: any) => p.results > 0).sort((a: any, b: any) => b.cpr - a.cpr).slice(0, 5)
  const maxPlacementSpend = Math.max(...placement.map((p: any) => p.spend), 1)

  const platformSpend: Record<string, number> = {}
  placement.forEach((p: any) => { const platform = p.dimension_value?.split(' ')[0] || 'Other'; platformSpend[platform] = (platformSpend[platform] || 0) + p.spend })
  const platformData = Object.entries(platformSpend).sort((a, b) => b[1] - a[1]).map(([name, spend]) => ({ name, spend }))
  const platformColors = ['#2563eb', '#dc2626', '#f59e0b', '#16a34a', '#8b5cf6']

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Placements Overview</h3>
          <p className="text-[11px] text-[#9d9da8]">{placement.length} active placements</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3 text-[12px]">
            <div><span className="text-[#9d9da8]">Total Spend</span><p className="font-semibold text-[18px]">{formatCompact(placementTotal.spend)}</p></div>
            <div><span className="text-[#9d9da8]">Overall CPR</span><p className="font-semibold text-[18px]">{placementTotal.results > 0 ? formatCurrency(placementTotal.spend / placementTotal.results) : '—'}</p></div>
          </div>
          {bestPlacement && (
            <div className="mt-3 pt-3 border-t border-[#e8e8ec]">
              <p className="text-[11px] text-[#9d9da8]">Best Performer</p>
              <p className="text-[13px] font-semibold text-[#16a34a]">{bestPlacement.dimension_value}</p>
              <p className="text-[12px] text-[#9d9da8]">{formatCurrency(bestPlacement.cpr)} CPR</p>
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Spend by Platform</h3>
          <div className="space-y-2">
            {platformData.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: platformColors[i % platformColors.length] }} />
                <span className="text-[12px] flex-1">{p.name}</span>
                <span className="text-[12px] font-semibold tabular-nums">{formatCurrency(p.spend)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Spend Distribution</h3>
          <div className="space-y-2">
            {placement.slice(0, 6).map((p: any) => (
              <div key={p.dimension_value}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] truncate max-w-[60%]">{p.dimension_value}</span>
                  <span className="text-[11px] text-[#9d9da8] tabular-nums">{formatCurrency(p.spend)}</span>
                </div>
                <div className="h-3 bg-[#f4f4f6] rounded overflow-hidden">
                  <div className="h-full bg-[#dc2626] rounded" style={{ width: `${(p.spend / maxPlacementSpend) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-[13px] font-semibold mb-3">Top Placements</h3>
        <div className="space-y-2">
          {placement.slice(0, 12).map((p: any) => (
            <div key={p.dimension_value} className="flex items-center gap-3">
              <span className="text-[11px] text-[#6b6b76] truncate w-[180px] text-right">{p.dimension_value}</span>
              <div className="flex-1 h-5 bg-[#f4f4f6] rounded overflow-hidden">
                <div className="h-full bg-[#16a34a] rounded" style={{ width: `${(p.spend / maxPlacementSpend) * 100}%` }} />
              </div>
              <span className="text-[11px] tabular-nums w-16 text-right">{formatCurrency(p.spend)}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold text-[#16a34a] mb-3">Top Performers</h3>
          <div className="space-y-2">
            {topPlacements.map((p: any, i: number) => (
              <div key={p.dimension_value} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded bg-[#dcfce7] text-[#16a34a] text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-[12px] flex-1 truncate">{p.dimension_value}</span>
                <span className="text-[12px] font-semibold tabular-nums">{formatCurrency(p.cpr)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold text-[#dc2626] mb-3">Needs Attention</h3>
          <div className="space-y-2">
            {worstPlacements.map((p: any, i: number) => (
              <div key={p.dimension_value} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded bg-[#fef2f2] text-[#dc2626] text-[10px] font-bold flex items-center justify-center">{placement.length - i}</span>
                <span className="text-[12px] flex-1 truncate">{p.dimension_value}</span>
                <span className="text-[12px] font-semibold tabular-nums">{formatCurrency(p.cpr)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-[#e8e8ec]"><h3 className="text-[13px] font-semibold">All Placements</h3></div>
        <DataTable columns={[
          { key: 'dimension_value', label: 'Placement', format: (v: any) => <span className="font-medium">{v}</span> },
          { key: 'spend', label: 'Spend', format: (v: any) => formatCurrency(v), align: 'right' },
          { key: 'impressions', label: 'Impressions', format: (v: any) => formatNumber(v), align: 'right' },
          { key: 'clicks', label: 'Clicks', format: (v: any) => formatNumber(v), align: 'right' },
          { key: 'results', label: resultLabel, format: (v: any) => formatNumber(v), align: 'right' },
          { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
          { key: 'cpr', label: 'CPR', format: (v: number) => {
            if (v === 0) return <span className="text-[#c4c4cc]">—</span>
            return <span className={`font-semibold ${targetCpl && v > targetCpl ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(v)}</span>
          }, align: 'right' },
          { key: '_pct', label: '% Total', format: (_: any, row: any) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
        ]} data={placement} />
      </Card>
    </div>
  )
}
