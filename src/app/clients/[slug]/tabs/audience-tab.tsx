'use client'

import { Card } from '@/components/ui/card'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { DataTable } from './shared'

interface AudienceTabProps {
  ageGender: any[]
  device: any[]
  resultLabel: string
  targetCpl: number | null
  totalSpend: number
}

export function AudienceTab({ ageGender, device, resultLabel, targetCpl, totalSpend }: AudienceTabProps) {
  const audienceTotal = { spend: 0, results: 0, impressions: 0, clicks: 0 }
  ageGender.forEach((r: any) => { audienceTotal.spend += r.spend; audienceTotal.results += r.results; audienceTotal.impressions += r.impressions; audienceTotal.clicks += r.clicks })
  const bestAudienceSegment = [...ageGender].filter((a: any) => a.results > 0).sort((a: any, b: any) => a.cpr - b.cpr)[0]
  const topAudienceSegments = [...ageGender].filter((a: any) => a.results > 0 && a.cpr > 0).sort((a: any, b: any) => a.cpr - b.cpr).slice(0, 3)
  const worstAudienceSegments = [...ageGender].filter((a: any) => a.results > 0 && a.cpr > 0).sort((a: any, b: any) => b.cpr - a.cpr).slice(0, 3)

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4"><p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Segments</p><p className="text-[18px] font-semibold tabular-nums mt-1">{ageGender.length}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Total Spend</p><p className="text-[18px] font-semibold tabular-nums mt-1">{formatCurrency(audienceTotal.spend)}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">{resultLabel}</p><p className="text-[18px] font-semibold tabular-nums mt-1">{formatNumber(audienceTotal.results)}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Overall CPR</p><p className={`text-[18px] font-semibold tabular-nums mt-1 ${targetCpl && audienceTotal.results > 0 && (audienceTotal.spend / audienceTotal.results) > targetCpl ? 'text-[#dc2626]' : ''}`}>{audienceTotal.results > 0 ? formatCurrency(audienceTotal.spend / audienceTotal.results) : '—'}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Best Segment</p><p className="text-[13px] font-semibold text-[#16a34a] mt-1">{bestAudienceSegment?.dimension_value || '—'}</p><p className="text-[11px] text-[#9d9da8]">{bestAudienceSegment ? `${formatCurrency(bestAudienceSegment.cpr)} CPR` : ''}</p></Card>
      </div>

      {/* Spend by Segment + Device */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-4">Spend by Segment</h3>
          <div className="space-y-2.5">
            {ageGender.slice(0, 10).map((seg: any) => {
              const maxSeg = ageGender[0]?.spend || 1
              return (
                <div key={seg.dimension_value} className="flex items-center gap-3">
                  <span className="text-[11px] font-medium w-[100px] truncate text-[#6b6b76]">{seg.dimension_value}</span>
                  <div className="flex-1 h-5 bg-[#f4f4f6] rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${(seg.spend / maxSeg) * 100}%`, backgroundColor: seg.dimension_value?.includes('female') ? '#dc2626' : seg.dimension_value?.includes('male') ? '#2563eb' : '#f59e0b' }} />
                  </div>
                  <span className="text-[11px] tabular-nums text-right w-[60px] font-medium">{formatCurrency(seg.spend)}</span>
                  <span className="text-[11px] tabular-nums text-right w-[70px] text-[#9d9da8]">{seg.results} {resultLabel.toLowerCase()}</span>
                </div>
              )
            })}
          </div>
        </Card>
        <Card>
          <div className="px-5 py-4 border-b border-[#e8e8ec]"><h3 className="text-[13px] font-semibold">Device Performance</h3></div>
          <DataTable columns={[
            { key: 'dimension_value', label: 'Device', format: (v: any) => <span className="font-medium">{v}</span> },
            { key: 'spend', label: 'Spend', format: (v: any) => formatCurrency(v), align: 'right' },
            { key: 'results', label: resultLabel, format: (v: any) => formatNumber(v), align: 'right' },
            { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? <span className={targetCpl && v > targetCpl ? 'text-[#dc2626] font-semibold' : 'text-[#16a34a] font-semibold'}>{formatCurrency(v)}</span> : <span className="text-[#c4c4cc]">—</span>, align: 'right' },
            { key: '_pct', label: '% Spend', format: (_: any, row: any) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
          ]} data={device} pageSize={20} />
        </Card>
      </div>

      {/* Best vs Worst */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {topAudienceSegments.length > 0 && (
          <Card className="p-5">
            <h3 className="text-[13px] font-semibold mb-3">Best Performers</h3>
            <div className="space-y-2">
              {topAudienceSegments.map((seg: any, i: number) => (
                <div key={seg.dimension_value} className="flex items-center gap-3 py-2.5 border-b border-[#f4f4f6] last:border-0">
                  <span className="w-5 h-5 rounded bg-[#f0fdf4] text-[#16a34a] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium">{seg.dimension_value}</p>
                    <p className="text-[11px] text-[#9d9da8]">{seg.results} {resultLabel.toLowerCase()} · {((seg.spend / totalSpend) * 100).toFixed(1)}% spend</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] font-semibold tabular-nums text-[#16a34a]">{formatCurrency(seg.cpr)}</p>
                    {targetCpl && <p className="text-[10px] text-[#16a34a]">{(((seg.cpr / targetCpl) - 1) * 100).toFixed(0)}% vs target</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        {worstAudienceSegments.length > 0 && (
          <Card className="p-5">
            <h3 className="text-[13px] font-semibold mb-3">Needs Attention</h3>
            <div className="space-y-2">
              {worstAudienceSegments.map((seg: any, i: number) => {
                const potentialSavings = targetCpl && seg.cpr > targetCpl ? (seg.cpr - targetCpl) * seg.results : 0
                return (
                  <div key={seg.dimension_value} className="flex items-center gap-3 py-2.5 border-b border-[#f4f4f6] last:border-0">
                    <span className="w-5 h-5 rounded bg-[#fef2f2] text-[#dc2626] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium">{seg.dimension_value}</p>
                      <p className="text-[11px] text-[#9d9da8]">{seg.results} {resultLabel.toLowerCase()} · {((seg.spend / totalSpend) * 100).toFixed(1)}% spend</p>
                      {potentialSavings > 0 && <p className="text-[10px] text-[#dc2626]">Potential savings: {formatCurrency(potentialSavings)}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[13px] font-semibold tabular-nums text-[#dc2626]">{formatCurrency(seg.cpr)}</p>
                      {targetCpl && <p className="text-[10px] text-[#dc2626]">+{(((seg.cpr / targetCpl) - 1) * 100).toFixed(0)}% vs target</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Full Breakdown */}
      <Card>
        <div className="px-5 py-4 border-b border-[#e8e8ec]"><h3 className="text-[13px] font-semibold">All Segments</h3></div>
        <DataTable columns={[
          { key: 'dimension_value', label: 'Segment', format: (v: any) => <span className="font-medium">{v}</span> },
          { key: 'spend', label: 'Spend', format: (v: any) => formatCurrency(v), align: 'right' },
          { key: 'impressions', label: 'Impressions', format: (v: any) => formatNumber(v), align: 'right' },
          { key: 'clicks', label: 'Clicks', format: (v: any) => formatNumber(v), align: 'right' },
          { key: 'results', label: resultLabel, format: (v: any) => formatNumber(v), align: 'right' },
          { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
          { key: 'cpr', label: 'CPR', format: (v: number) => {
            if (v === 0) return <span className="text-[#c4c4cc]">—</span>
            const isOver = targetCpl ? v > targetCpl : false
            return <span className={`font-semibold ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(v)}</span>
          }, align: 'right' },
          { key: '_pct', label: '% Spend', format: (_: any, row: any) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
        ]} data={ageGender} />
      </Card>
    </div>
  )
}
