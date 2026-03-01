'use client'

import { Card } from '@/components/ui/card'
import { DataTable } from './shared'
import { formatCurrency, formatNumber, formatPercent, formatCompact } from '@/lib/utils'

const stateAbbr: Record<string, string> = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO',
  'Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID',
  'Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA',
  'Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS',
  'Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
  'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
  'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',
  'Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA',
  'West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY','District of Columbia':'DC',
}

const regionMap: Record<string, string[]> = {
  'Northeast': ['Connecticut','Maine','Massachusetts','New Hampshire','New Jersey','New York','Pennsylvania','Rhode Island','Vermont'],
  'Southeast': ['Alabama','Arkansas','Delaware','Florida','Georgia','Kentucky','Louisiana','Maryland','Mississippi','North Carolina','South Carolina','Tennessee','Virginia','West Virginia','District of Columbia'],
  'Midwest': ['Illinois','Indiana','Iowa','Kansas','Michigan','Minnesota','Missouri','Nebraska','North Dakota','Ohio','South Dakota','Wisconsin'],
  'Southwest': ['Arizona','New Mexico','Oklahoma','Texas'],
  'West': ['Alaska','California','Colorado','Hawaii','Idaho','Montana','Nevada','Oregon','Utah','Washington','Wyoming'],
}

function getAbbr(name: string) { return stateAbbr[name] || name?.slice(0, 2).toUpperCase() || '??' }

interface GeographicTabProps {
  region: any[]
  totalSpend: number
}

export function GeographicTab({ region, totalSpend }: GeographicTabProps) {
  const geoTotal = { spend: 0, impressions: 0, clicks: 0 }
  region.forEach(r => { geoTotal.spend += r.spend; geoTotal.impressions += r.impressions; geoTotal.clicks += r.clicks })
  const maxR = region[0]?.spend || 1

  const regionGroups: Record<string, { spend: number; ctr: number; count: number }> = {}
  for (const [rg, states] of Object.entries(regionMap)) {
    let spend = 0, impr = 0, clicks = 0, count = 0
    region.forEach(r => { if (states.some(s => r.dimension_value === s)) { spend += r.spend; impr += r.impressions; clicks += r.clicks; count++ } })
    if (count) regionGroups[rg] = { spend, ctr: impr > 0 ? (clicks / impr) * 100 : 0, count }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-2">Geographic Overview</h3>
          <p className="text-[11px] text-[#9d9da8] mb-3">{region.length} states active</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
            <div><span className="text-[#9d9da8]">Total Spend</span><p className="font-semibold text-[18px]">{formatCompact(geoTotal.spend)}</p></div>
            <div><span className="text-[#9d9da8]">Impressions</span><p className="font-semibold text-[18px]">{formatCompact(geoTotal.impressions)}</p></div>
            <div><span className="text-[#9d9da8]">Clicks</span><p className="font-semibold text-[18px]">{formatCompact(geoTotal.clicks)}</p></div>
            <div><span className="text-[#9d9da8]">CTR</span><p className="font-semibold text-[18px]">{geoTotal.impressions > 0 ? formatPercent((geoTotal.clicks / geoTotal.impressions) * 100) : '—'}</p></div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Regional Performance</h3>
          <div className="space-y-2">
            {Object.entries(regionGroups).sort((a, b) => b[1].spend - a[1].spend).map(([name, data]) => (
              <div key={name} className="flex items-center justify-between text-[12px]">
                <span className="font-medium">{name} <span className="text-[#9d9da8]">({data.count})</span></span>
                <span className="tabular-nums text-[#6b6b76]">{formatCurrency(data.spend)} · {formatPercent(data.ctr)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Top States</h3>
          <div className="grid grid-cols-5 gap-1.5">
            {region.slice(0, 15).map(r => {
              const abbr = getAbbr(r.dimension_value)
              const pct = totalSpend > 0 ? ((r.spend / totalSpend) * 100).toFixed(1) : '0'
              return (
                <div key={r.dimension_value} className="text-center p-1.5 rounded bg-[#f4f4f6]">
                  <p className="text-[11px] font-semibold text-[#2563eb]">{abbr}</p>
                  <p className="text-[9px] text-[#9d9da8]">{pct}%</p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-[13px] font-semibold mb-3">Top States by Spend</h3>
        <div className="space-y-2">
          {region.slice(0, 10).map(r => (
            <div key={r.dimension_value} className="flex items-center gap-3">
              <span className="text-[11px] font-medium w-8 text-[#6b6b76]">{getAbbr(r.dimension_value)}</span>
              <div className="flex-1 h-5 bg-[#f4f4f6] rounded overflow-hidden">
                <div className="h-full bg-[#16a34a] rounded" style={{ width: `${(r.spend / maxR) * 100}%` }} />
              </div>
              <span className="text-[11px] tabular-nums w-16 text-right font-medium">{formatCurrency(r.spend)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-[#e8e8ec]">
          <h3 className="text-[13px] font-semibold">All States</h3>
        </div>
        <DataTable
          columns={[
            { key: 'dimension_value', label: 'State', format: (v: string) => <div className="flex items-center gap-2"><span className="text-[11px] text-[#9d9da8] font-medium w-6">{getAbbr(v)}</span><span className="font-medium">{v}</span></div> },
            { key: 'spend', label: 'Spend', format: (v: number) => formatCurrency(v), align: 'right' as const },
            { key: 'impressions', label: 'Impressions', format: (v: number) => formatNumber(v), align: 'right' as const },
            { key: 'clicks', label: 'Clicks', format: (v: number) => formatNumber(v), align: 'right' as const },
            { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' as const },
            { key: '_pct', label: '% of Spend', format: (_: any, row: any) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' as const },
          ]}
          data={region}
        />
      </Card>
    </div>
  )
}
