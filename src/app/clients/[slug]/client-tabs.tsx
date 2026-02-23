'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber, formatPercent, wowChange, wowChangeCPL } from '@/lib/utils'
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
  funnelSteps: { label: string; value: number; rate?: number; rateLabel?: string; icon?: string }[]
  ageGender: any[]
  placement: any[]
  device: any[]
  region: any[]
  resultLabel: string
  isEcom: boolean
  targetCpl: number | null
  targetRoas: number | null
  totalSpend: number
}

function MetricBox({ label, value, subtext, sparkData, change, icon }: {
  label: string; value: string; subtext?: string; sparkData?: number[]; change?: { label: string; positive: boolean }; icon?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] text-[#86868b] uppercase tracking-wider mb-1">{label}</p>
          <p className="text-[22px] font-bold tabular-nums">{value}</p>
          {subtext && <p className="text-[12px] text-[#86868b] mt-0.5">{subtext}</p>}
          {change && change.label !== '—' && (
            <p className={`text-[12px] font-medium mt-1 ${change.positive ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
              ↗ {change.label} vs last week
            </p>
          )}
        </div>
        {icon && <span className="text-lg opacity-40">{icon}</span>}
      </div>
      {sparkData && sparkData.length > 0 && (
        <div className="mt-2 flex items-end gap-[2px] h-[30px]">
          {sparkData.map((v, i) => {
            const max = Math.max(...sparkData, 1)
            return <div key={i} className="flex-1 bg-[#007aff30] rounded-sm" style={{ height: `${(v / max) * 100}%`, minHeight: 2 }} />
          })}
        </div>
      )}
    </Card>
  )
}

function DataTable({ columns, data }: { columns: { key: string; label: string; format?: (v: any, row?: any) => string | React.ReactNode; align?: string }[]; data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[#e5e5e5]">
            {columns.map(col => (
              <th key={col.key} className={`py-2.5 px-3 text-[11px] text-[#86868b] font-medium uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
              {columns.map(col => (
                <td key={col.key} className={`py-2.5 px-3 tabular-nums ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.format ? col.format(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const tooltipStyle = {
  contentStyle: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  labelStyle: { color: '#86868b' },
}

export function ClientTabs({ daily, campaigns, ads, topAds, bottomAds, funnelSteps, ageGender, placement, device, region, resultLabel, isEcom, targetCpl, targetRoas, totalSpend }: ClientTabsProps) {
  const chartData = daily.map(d => ({
    date: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    spend: Math.round(d.spend * 100) / 100,
    results: d.results,
    cpr: d.results > 0 ? Math.round((d.spend / d.results) * 100) / 100 : 0,
    impressions: d.impressions,
    clicks: d.clicks,
  }))

  // WoW calcs
  const tw = daily.slice(-7)
  const lw = daily.slice(-14, -7)
  const twSum = (key: string) => tw.reduce((s, d) => s + (d[key] || 0), 0)
  const lwSum = (key: string) => lw.reduce((s, d) => s + (d[key] || 0), 0)

  // Best day
  const bestDay = [...daily].filter(d => d.results > 0).sort((a, b) => {
    const aCpr = a.spend / a.results
    const bCpr = b.spend / b.results
    return aCpr - bCpr
  })[0]

  // DOW
  const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dowMap: Record<string, { spend: number; results: number; days: number }> = {}
  daily.forEach(d => {
    const dow = dowNames[new Date(d.date + 'T12:00:00').getDay()]
    if (!dowMap[dow]) dowMap[dow] = { spend: 0, results: 0, days: 0 }
    dowMap[dow].spend += d.spend
    dowMap[dow].results += d.results
    dowMap[dow].days++
  })

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">✦ Overview</TabsTrigger>
        <TabsTrigger value="ads">📋 Ads ({ads.length})</TabsTrigger>
        <TabsTrigger value="campaigns">📊 Campaigns</TabsTrigger>
        <TabsTrigger value="daily">📅 Daily</TabsTrigger>
        {ageGender.length > 0 && <TabsTrigger value="audience">👥 Audience</TabsTrigger>}
        {placement.length > 0 && <TabsTrigger value="placements">📍 Placements</TabsTrigger>}
        {region.length > 0 && <TabsTrigger value="geographic">🗺️ Geographic</TabsTrigger>}
      </TabsList>

      {/* ═══ OVERVIEW ═══ */}
      <TabsContent value="overview">
        <div className="space-y-5">
          {/* Performance Trend */}
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-4">Performance Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#86868b' }} interval={Math.floor(chartData.length / 8)} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#86868b' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#86868b' }} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#007aff" fill="#007aff" fillOpacity={0.08} name="Spend ($)" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="results" stroke="#34c759" fill="#34c759" fillOpacity={0.08} name={resultLabel} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* 6 Metric Boxes */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <MetricBox label="Spend" value={formatCurrency(twSum('spend'))} icon="$" sparkData={tw.map(d => d.spend)} change={wowChange(twSum('spend'), lwSum('spend'))} />
            <MetricBox label={resultLabel} value={formatNumber(twSum('results'))} icon="📊" sparkData={tw.map(d => d.results)} change={wowChange(twSum('results'), lwSum('results'))} />
            <MetricBox label="CPR" value={twSum('results') > 0 ? formatCurrency(twSum('spend') / twSum('results')) : '—'} icon="🎯" change={wowChangeCPL(twSum('results') > 0 ? twSum('spend')/twSum('results') : 0, lwSum('results') > 0 ? lwSum('spend')/lwSum('results') : 0)} />
            <MetricBox label="Impressions" value={formatNumber(twSum('impressions'))} icon="👁️" sparkData={tw.map(d => d.impressions)} change={wowChange(twSum('impressions'), lwSum('impressions'))} />
            <MetricBox label="Clicks" value={formatNumber(twSum('clicks'))} icon="🖱️" sparkData={tw.map(d => d.clicks)} change={wowChange(twSum('clicks'), lwSum('clicks'))} />
            <MetricBox label="CTR" value={twSum('impressions') > 0 ? formatPercent((twSum('clicks') / twSum('impressions')) * 100) : '—'} icon="📈" />
          </div>

          {/* Top/Bottom Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {topAds.length > 0 && (
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold text-[#34c759] mb-3">✅ Top Performers</h3>
                <div className="space-y-3">
                  {topAds.map((ad, i) => (
                    <div key={ad.platform_ad_id} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#34c75920] text-[#34c759] text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{ad.ad_name}</p>
                        <p className="text-[11px] text-[#86868b]">{formatCurrency(ad.spend)} spent · {ad.results} {ad.result_label}</p>
                      </div>
                      <span className="text-[14px] font-bold text-[#34c759] tabular-nums">{formatCurrency(ad.cpr)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {bottomAds.length > 0 && (
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold text-[#ff3b30] mb-3">⚠️ Underperformers</h3>
                <div className="space-y-3">
                  {bottomAds.map((ad, i) => (
                    <div key={ad.platform_ad_id} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#ff3b3020] text-[#ff3b30] text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{ad.ad_name}</p>
                        <p className="text-[11px] text-[#86868b]">{formatCurrency(ad.spend)} spent · {ad.results} {ad.result_label}</p>
                      </div>
                      <span className="text-[14px] font-bold text-[#ff3b30] tabular-nums">{formatCurrency(ad.cpr)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Funnel Health */}
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-4">Funnel Health</h3>
            <div className="flex items-center justify-around mb-4">
              {funnelSteps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-[11px] text-[#86868b]">{step.icon}</p>
                    <p className="text-[22px] font-bold tabular-nums">{formatNumber(step.value)}</p>
                    <p className="text-[11px] text-[#86868b]">{step.label}</p>
                  </div>
                  {step.rate !== undefined && i > 0 && (
                    <div className="text-center mx-2">
                      <p className="text-[11px] text-[#86868b]">→</p>
                      <p className="text-[12px] font-medium">{step.rateLabel}: {step.rate.toFixed(2)}%</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Funnel bars */}
            <div className="space-y-2">
              {funnelSteps.map(step => {
                const maxVal = funnelSteps[0].value || 1
                const pct = (step.value / maxVal) * 100
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <span className="text-[11px] text-[#86868b] w-20 text-right">{step.label}</span>
                    <div className="flex-1 h-4 bg-[#f0f0f0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#007aff] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-[#86868b] w-16 tabular-nums">{formatNumber(step.value)}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </TabsContent>

      {/* ═══ ADS ═══ */}
      <TabsContent value="ads">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold">All Ads · {ads.length}</h3>
          </div>
          <DataTable
            columns={[
              { key: 'ad_name', label: 'Ad', format: (v) => <span className="font-medium">{v}</span> },
              { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
              { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
              { key: 'cpr', label: 'CPR', format: (v: number) => {
                if (v === 0) return <span className="text-[#aeaeb2]">—</span>
                const isOver = targetCpl ? v > targetCpl : false
                return <span className={isOver ? 'text-[#ff3b30] font-semibold' : 'text-[#34c759] font-semibold'}>{formatCurrency(v)}</span>
              }, align: 'right' },
              { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
            ]}
            data={ads}
          />
        </Card>
      </TabsContent>

      {/* ═══ CAMPAIGNS ═══ */}
      <TabsContent value="campaigns">
        <div className="space-y-5">
          {/* Spend Distribution */}
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-3">Spend Distribution</h3>
            <div className="space-y-2">
              {campaigns.map(c => {
                const pct = totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0
                return (
                  <div key={c.platform_campaign_id} className="flex items-center gap-3">
                    <span className="text-[12px] truncate w-48">{c.campaign_name}</span>
                    <div className="flex-1 h-3 bg-[#f0f0f0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#ff3b30] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-[#86868b] w-24 text-right tabular-nums">{c.results} {resultLabel.toLowerCase()} {formatCurrency(c.spend)}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Campaign Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map(c => (
              <Card key={c.platform_campaign_id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-[13px] font-semibold truncate max-w-[200px]">{c.campaign_name}</h4>
                    <Badge variant="onTarget">Active</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div><span className="text-[#86868b]">$ Spend</span><p className="font-semibold">{formatCurrency(c.spend)}</p></div>
                  <div><span className="text-[#86868b]">📊 {resultLabel}</span><p className="font-semibold">{c.results}</p></div>
                  <div><span className="text-[#86868b]">🎯 CPR</span><p className="font-semibold">{c.cpr > 0 ? formatCurrency(c.cpr) : '—'}</p></div>
                  <div><span className="text-[#86868b]">📈 CTR</span><p className="font-semibold">{formatPercent(c.ctr)}</p></div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </TabsContent>

      {/* ═══ DAILY ═══ */}
      <TabsContent value="daily">
        <div className="space-y-5">
          {/* Summary boxes */}
          <div className="grid grid-cols-4 gap-4">
            <MetricBox label="Total Spend" value={formatCurrency(daily.reduce((s, d) => s + d.spend, 0))} subtext={`~${formatCurrency(daily.reduce((s, d) => s + d.spend, 0) / (daily.length || 1))}/day`} icon="$" sparkData={daily.map(d => d.spend)} />
            <MetricBox label={`Total ${resultLabel}`} value={formatNumber(daily.reduce((s, d) => s + d.results, 0))} subtext={`~${(daily.reduce((s, d) => s + d.results, 0) / (daily.length || 1)).toFixed(1)}/day`} icon="📊" sparkData={daily.map(d => d.results)} />
            <MetricBox label="Avg CPR" value={daily.reduce((s, d) => s + d.results, 0) > 0 ? formatCurrency(daily.reduce((s, d) => s + d.spend, 0) / daily.reduce((s, d) => s + d.results, 0)) : '—'} subtext={`Over ${daily.length} days`} icon="🎯" />
            {bestDay && (
              <Card className="p-4">
                <p className="text-[11px] text-[#86868b] uppercase tracking-wider mb-1">Best Day</p>
                <p className="text-[16px] font-bold">{new Date(bestDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                <p className="text-[12px] text-[#34c759]">{formatCurrency(bestDay.spend / bestDay.results)} CPR · {bestDay.results} {resultLabel.toLowerCase()}</p>
              </Card>
            )}
          </div>

          {/* Daily chart */}
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-3">Daily Breakdown</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#86868b' }} interval={Math.floor(chartData.length / 10)} />
                <YAxis tick={{ fontSize: 11, fill: '#86868b' }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="results" fill="#007aff" radius={[3, 3, 0, 0]} name={resultLabel} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Daily table */}
          <Card className="p-5">
            <DataTable
              columns={[
                { key: 'date', label: 'Date', format: (v) => new Date(v + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) },
                { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                { key: 'cpr', label: 'CPR', format: (v: number, row: any) => {
                  if (!row.results) return <span className="text-[#aeaeb2]">—</span>
                  const val = row.spend / row.results
                  const isOver = targetCpl ? val > targetCpl : false
                  return <span className={`font-semibold ${isOver ? 'text-[#ff3b30]' : 'text-[#34c759]'}`}>{formatCurrency(val)}</span>
                }, align: 'right' },
                { key: 'ctr', label: 'CTR', format: (v: number, row: any) => row.impressions > 0 ? formatPercent((row.clicks / row.impressions) * 100) : '—', align: 'right' },
              ]}
              data={[...daily].reverse()}
            />
          </Card>
        </div>
      </TabsContent>

      {/* ═══ AUDIENCE ═══ */}
      {ageGender.length > 0 && (
        <TabsContent value="audience">
          <div className="space-y-5">
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold mb-3">Age & Gender Performance</h3>
              <DataTable
                columns={[
                  { key: 'dimension_value', label: 'Segment', format: (v) => <span className="font-medium">{v}</span> },
                  { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                  { key: 'impressions', label: 'Impressions', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'clicks', label: 'Clicks', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                  { key: 'cpr', label: 'CPR', format: (v: number) => {
                    if (v === 0) return <span className="text-[#aeaeb2]">—</span>
                    const isOver = targetCpl ? v > targetCpl : false
                    return <span className={isOver ? 'text-[#ff3b30] font-semibold' : 'text-[#34c759] font-semibold'}>{formatCurrency(v)}</span>
                  }, align: 'right' },
                  { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
                  { key: '_pct', label: '% Total', format: (_, row) => totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—', align: 'right' },
                ]}
                data={ageGender}
              />
            </Card>

            {/* Device Performance */}
            {device.length > 0 && (
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold mb-3">Device Performance</h3>
                <div className="grid grid-cols-3 gap-4">
                  {device.map(d => (
                    <div key={d.dimension_value} className="rounded-xl bg-[#f5f5f7] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#007aff]" />
                        <span className="text-[13px] font-medium">{d.dimension_value}</span>
                      </div>
                      <p className="text-[20px] font-bold tabular-nums">{formatCurrency(d.spend)}</p>
                      <p className="text-[12px] text-[#86868b]">{d.results} {resultLabel.toLowerCase()} · CPR: {d.cpr > 0 ? formatCurrency(d.cpr) : '—'}</p>
                      <p className="text-[11px] text-[#aeaeb2]">{totalSpend > 0 ? ((d.spend / totalSpend) * 100).toFixed(1) : 0}% of spend</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </TabsContent>
      )}

      {/* ═══ PLACEMENTS ═══ */}
      {placement.length > 0 && (
        <TabsContent value="placements">
          <div className="space-y-5">
            {/* Horizontal bar chart */}
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold mb-3">Top Placements</h3>
              <div className="space-y-2">
                {placement.slice(0, 10).map(p => {
                  const maxSpend = placement[0]?.spend || 1
                  return (
                    <div key={p.dimension_value} className="flex items-center gap-3">
                      <span className="text-[11px] text-[#86868b] truncate w-40 text-right">{p.dimension_value}</span>
                      <div className="flex-1 h-5 bg-[#f0f0f0] rounded overflow-hidden">
                        <div className="h-full bg-[#34c759] rounded" style={{ width: `${(p.spend / maxSpend) * 100}%` }} />
                      </div>
                      <span className="text-[11px] tabular-nums w-16 text-right">{formatCurrency(p.spend)}</span>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-[14px] font-semibold mb-3">All Placements</h3>
              <DataTable
                columns={[
                  { key: 'dimension_value', label: 'Placement', format: (v) => <span className="font-medium">{v}</span> },
                  { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                  { key: 'impressions', label: 'Impressions', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'clicks', label: 'Clicks', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                  { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? formatCurrency(v) : '—', align: 'right' },
                  { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
                  { key: '_pct', label: '% Total', format: (_, row) => totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—', align: 'right' },
                ]}
                data={placement}
              />
            </Card>
          </div>
        </TabsContent>
      )}

      {/* ═══ GEOGRAPHIC ═══ */}
      {region.length > 0 && (
        <TabsContent value="geographic">
          <div className="space-y-5">
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold mb-3">Top States by Spend</h3>
              <div className="space-y-2">
                {region.slice(0, 10).map(r => {
                  const maxSpend = region[0]?.spend || 1
                  return (
                    <div key={r.dimension_value} className="flex items-center gap-3">
                      <span className="text-[11px] font-medium w-8">{r.dimension_value?.slice(0, 2).toUpperCase()}</span>
                      <span className="text-[11px] text-[#86868b] truncate w-28">{r.dimension_value}</span>
                      <div className="flex-1 h-5 bg-[#f0f0f0] rounded overflow-hidden">
                        <div className="h-full bg-[#ff9500] rounded" style={{ width: `${(r.spend / maxSpend) * 100}%` }} />
                      </div>
                      <span className="text-[11px] tabular-nums w-16 text-right">{formatCurrency(r.spend)}</span>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-[14px] font-semibold mb-3">All States</h3>
              <DataTable
                columns={[
                  { key: 'dimension_value', label: 'State', format: (v) => <span className="font-medium">{v}</span> },
                  { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                  { key: 'impressions', label: 'Impressions', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'clicks', label: 'Clicks', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
                  { key: '_pct', label: '% Total', format: (_, row) => totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—', align: 'right' },
                ]}
                data={region}
              />
            </Card>
          </div>
        </TabsContent>
      )}
    </Tabs>
  )
}
