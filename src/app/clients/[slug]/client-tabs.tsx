'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber, formatPercent, grade, roasGrade } from '@/lib/utils'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface ClientTabsProps {
  daily: any[]
  campaigns: any[]
  ads: any[]
  topAds: any[]
  bottomAds: any[]
  funnelSteps: { label: string; value: number; rate?: number }[]
  ageGender: any[]
  placement: any[]
  device: any[]
  region: any[]
  resultLabel: string
  isEcom: boolean
  targetCpl: number | null
  targetRoas: number | null
}

function DataTable({ columns, data }: { columns: { key: string; label: string; format?: (v: any) => string; align?: string }[]; data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            {columns.map(col => (
              <th key={col.key} className={`py-2 px-3 text-xs text-zinc-500 font-medium ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              {columns.map(col => (
                <td key={col.key} className={`py-2 px-3 tabular-nums ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.format ? col.format(row[col.key]) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AdCard({ ad, targetCpl, isEcom, targetRoas, rank, type }: any) {
  const g = isEcom ? roasGrade(ad.spend > 0 ? ad.results / ad.spend : 0, targetRoas) : grade(targetCpl ? ad.cpr / targetCpl : 1)
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${g.color} bg-zinc-800`}>
        {g.letter}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{ad.ad_name}</p>
        <p className="text-xs text-zinc-500">{formatNumber(ad.results)} {ad.result_label} · {formatCurrency(ad.spend)} spend</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold tabular-nums ${type === 'top' ? 'text-emerald-400' : 'text-red-400'}`}>
          {ad.cpr > 0 ? formatCurrency(ad.cpr) : '—'}
        </p>
        <p className="text-xs text-zinc-500">CPR</p>
      </div>
    </div>
  )
}

const chartTooltipStyle = {
  contentStyle: { background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' },
  labelStyle: { color: '#a1a1aa' },
}

export function ClientTabs({ daily, campaigns, ads, topAds, bottomAds, funnelSteps, ageGender, placement, device, region, resultLabel, isEcom, targetCpl, targetRoas }: ClientTabsProps) {
  const chartData = daily.map(d => ({
    date: d.date.slice(5), // MM-DD
    spend: d.spend,
    results: d.results,
    cpr: d.results > 0 ? d.spend / d.results : 0,
    impressions: d.impressions,
    clicks: d.clicks,
  }))

  // Day of week heatmap data
  const dowMap: Record<string, { spend: number; results: number; days: number }> = {}
  const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  daily.forEach(d => {
    const dow = dowNames[new Date(d.date + 'T12:00:00').getDay()]
    if (!dowMap[dow]) dowMap[dow] = { spend: 0, results: 0, days: 0 }
    dowMap[dow].spend += d.spend
    dowMap[dow].results += d.results
    dowMap[dow].days++
  })
  const dowData = dowNames.map(d => ({
    day: d,
    avgResults: dowMap[d] ? dowMap[d].results / dowMap[d].days : 0,
    avgSpend: dowMap[d] ? dowMap[d].spend / dowMap[d].days : 0,
    avgCpr: dowMap[d] && dowMap[d].results > 0 ? dowMap[d].spend / dowMap[d].results : 0,
  }))

  const hasPlacements = placement.length > 0
  const hasAgeGender = ageGender.length > 0
  const hasRegion = region.length > 0
  const hasDevice = device.length > 0

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="ads">Ads</TabsTrigger>
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="daily">Daily</TabsTrigger>
        {hasAgeGender && <TabsTrigger value="audience">Audience</TabsTrigger>}
        {hasPlacements && <TabsTrigger value="placements">Placements</TabsTrigger>}
        {hasDevice && <TabsTrigger value="devices">Devices</TabsTrigger>}
        {hasRegion && <TabsTrigger value="geographic">Geographic</TabsTrigger>}
      </TabsList>

      {/* ── Overview Tab ── */}
      <TabsContent value="overview">
        <div className="space-y-6">
          {/* Funnel */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Funnel Health</h3>
            <div className="flex items-center gap-2 overflow-x-auto">
              {funnelSteps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div className="text-center min-w-[80px]">
                    <p className="text-lg font-bold tabular-nums">{formatNumber(step.value)}</p>
                    <p className="text-xs text-zinc-500">{step.label}</p>
                    {step.rate !== undefined && (
                      <p className="text-xs text-zinc-400 mt-0.5">{step.rate.toFixed(1)}%</p>
                    )}
                  </div>
                  {i < funnelSteps.length - 1 && <span className="text-zinc-600 text-lg">→</span>}
                </div>
              ))}
            </div>
          </Card>

          {/* Performance Chart */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Performance Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#71717a' }} />
                <Tooltip {...chartTooltipStyle} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} name="Spend ($)" />
                <Area yAxisId="right" type="monotone" dataKey="results" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name={resultLabel} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Top/Bottom Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {topAds.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-emerald-400 mb-3">🏆 Top Performers</h3>
                <div className="space-y-2">
                  {topAds.map((ad, i) => (
                    <AdCard key={ad.platform_ad_id} ad={ad} targetCpl={targetCpl} targetRoas={targetRoas} isEcom={isEcom} rank={i + 1} type="top" />
                  ))}
                </div>
              </Card>
            )}
            {bottomAds.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-red-400 mb-3">💸 Money Drains</h3>
                <div className="space-y-2">
                  {bottomAds.map((ad, i) => (
                    <AdCard key={ad.platform_ad_id} ad={ad} targetCpl={targetCpl} targetRoas={targetRoas} isEcom={isEcom} rank={i + 1} type="bottom" />
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </TabsContent>

      {/* ── Ads Tab ── */}
      <TabsContent value="ads">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">All Ads ({ads.length})</h3>
          <DataTable
            columns={[
              { key: 'ad_name', label: 'Ad' },
              { key: 'grade', label: 'Grade', format: (v) => v },
              { key: 'spend', label: 'Spend', format: formatCurrency, align: 'right' },
              { key: 'impressions', label: 'Impr', format: formatNumber, align: 'right' },
              { key: 'clicks', label: 'Clicks', format: formatNumber, align: 'right' },
              { key: 'results', label: resultLabel, format: formatNumber, align: 'right' },
              { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? formatCurrency(v) : '—', align: 'right' },
              { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
            ]}
            data={ads.map(a => ({
              ...a,
              grade: (() => {
                const g = targetCpl && a.cpr > 0 ? grade(a.cpr / targetCpl) : { letter: '—', color: 'text-zinc-500' }
                return `<span class="${g.color}">${g.letter}</span>`
              })(),
            })).map(a => ({ ...a, grade: targetCpl && a.cpr > 0 ? grade(a.cpr / targetCpl).letter : '—' }))}
          />
        </Card>
      </TabsContent>

      {/* ── Campaigns Tab ── */}
      <TabsContent value="campaigns">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Campaigns ({campaigns.length})</h3>
          <DataTable
            columns={[
              { key: 'campaign_name', label: 'Campaign' },
              { key: 'spend', label: 'Spend', format: formatCurrency, align: 'right' },
              { key: 'impressions', label: 'Impr', format: formatNumber, align: 'right' },
              { key: 'clicks', label: 'Clicks', format: formatNumber, align: 'right' },
              { key: 'results', label: resultLabel, format: formatNumber, align: 'right' },
              { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? formatCurrency(v) : '—', align: 'right' },
              { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
            ]}
            data={campaigns}
          />
        </Card>
      </TabsContent>

      {/* ── Daily Tab ── */}
      <TabsContent value="daily">
        <div className="space-y-6">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Daily Metrics</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#71717a' }} />
                <Tooltip {...chartTooltipStyle} />
                <Legend />
                <Bar yAxisId="left" dataKey="spend" fill="#6366f1" name="Spend ($)" radius={[2, 2, 0, 0]} />
                <Bar yAxisId="right" dataKey="results" fill="#10b981" name={resultLabel} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Day of Week */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Day of Week Performance</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
                <Tooltip {...chartTooltipStyle} />
                <Bar dataKey="avgResults" fill="#10b981" name={`Avg ${resultLabel}/day`} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Daily Table */}
          <Card className="p-4">
            <DataTable
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'spend', label: 'Spend', format: formatCurrency, align: 'right' },
                { key: 'impressions', label: 'Impr', format: formatNumber, align: 'right' },
                { key: 'clicks', label: 'Clicks', format: formatNumber, align: 'right' },
                { key: 'results', label: resultLabel, format: formatNumber, align: 'right' },
                { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? formatCurrency(v) : '—', align: 'right' },
              ]}
              data={[...daily].reverse().map(d => ({ ...d, cpr: d.results > 0 ? d.spend / d.results : 0 }))}
            />
          </Card>
        </div>
      </TabsContent>

      {/* ── Audience Tab ── */}
      {hasAgeGender && (
        <TabsContent value="audience">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Age & Gender</h3>
            <DataTable
              columns={[
                { key: 'dimension_value', label: 'Segment' },
                { key: 'spend', label: 'Spend', format: formatCurrency, align: 'right' },
                { key: 'impressions', label: 'Impr', format: formatNumber, align: 'right' },
                { key: 'clicks', label: 'Clicks', format: formatNumber, align: 'right' },
                { key: 'results', label: resultLabel, format: formatNumber, align: 'right' },
                { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? formatCurrency(v) : '—', align: 'right' },
                { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
              ]}
              data={ageGender}
            />
          </Card>
        </TabsContent>
      )}

      {/* ── Placements Tab ── */}
      {hasPlacements && (
        <TabsContent value="placements">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Placements</h3>
            <DataTable
              columns={[
                { key: 'dimension_value', label: 'Placement' },
                { key: 'spend', label: 'Spend', format: formatCurrency, align: 'right' },
                { key: 'impressions', label: 'Impr', format: formatNumber, align: 'right' },
                { key: 'clicks', label: 'Clicks', format: formatNumber, align: 'right' },
                { key: 'results', label: resultLabel, format: formatNumber, align: 'right' },
                { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? formatCurrency(v) : '—', align: 'right' },
                { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
              ]}
              data={placement}
            />
          </Card>
        </TabsContent>
      )}

      {/* ── Devices Tab ── */}
      {hasDevice && (
        <TabsContent value="devices">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Devices</h3>
            <DataTable
              columns={[
                { key: 'dimension_value', label: 'Device' },
                { key: 'spend', label: 'Spend', format: formatCurrency, align: 'right' },
                { key: 'impressions', label: 'Impr', format: formatNumber, align: 'right' },
                { key: 'clicks', label: 'Clicks', format: formatNumber, align: 'right' },
                { key: 'results', label: resultLabel, format: formatNumber, align: 'right' },
                { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? formatCurrency(v) : '—', align: 'right' },
                { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
              ]}
              data={device}
            />
          </Card>
        </TabsContent>
      )}

      {/* ── Geographic Tab ── */}
      {hasRegion && (
        <TabsContent value="geographic">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Geographic</h3>
            <DataTable
              columns={[
                { key: 'dimension_value', label: 'Region' },
                { key: 'spend', label: 'Spend', format: formatCurrency, align: 'right' },
                { key: 'impressions', label: 'Impr', format: formatNumber, align: 'right' },
                { key: 'clicks', label: 'Clicks', format: formatNumber, align: 'right' },
                { key: 'results', label: resultLabel, format: formatNumber, align: 'right' },
                { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? formatCurrency(v) : '—', align: 'right' },
              ]}
              data={region}
            />
          </Card>
        </TabsContent>
      )}
    </Tabs>
  )
}
