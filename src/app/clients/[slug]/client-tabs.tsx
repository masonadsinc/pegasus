'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber, formatPercent, wowChange, wowChangeCPL } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface ClientTabsProps {
  daily: any[]
  campaigns: any[]
  ads: any[]
  topAds: any[]
  bottomAds: any[]
  funnelSteps: { label: string; value: number; rate?: number; rateLabel?: string }[]
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

/* ── Sparkline SVG ──────────────────────────────── */
function Spark({ data, color = '#2563eb', height = 32, width = 100 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`)
  return (
    <svg width={width} height={height} className="mt-2">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

/* ── Stat Box with sparkline & WoW ──────────────── */
function StatBox({ label, value, sub, change, sparkData, sparkColor, icon, highlight }: {
  label: string; value: string; sub?: string; change?: { label: string; positive: boolean }; sparkData?: number[]; sparkColor?: string; icon?: string; highlight?: boolean
}) {
  return (
    <Card className={`p-4 ${highlight ? 'border-[#f59e0b] border-2' : ''}`}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider">{label}</p>
        {icon && <span className="text-[11px] text-[#9d9da8]">{icon}</span>}
      </div>
      <p className="text-xl font-bold tabular-nums text-[#111113] mt-1">{value}</p>
      <div className="flex items-center gap-2 mt-0.5">
        {sub && <span className="text-[11px] text-[#9d9da8]">{sub}</span>}
        {change && change.label !== '—' && (
          <span className={`text-[11px] font-medium ${change.positive ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
            {change.label}
          </span>
        )}
      </div>
      {sparkData && <Spark data={sparkData} color={sparkColor || '#2563eb'} />}
    </Card>
  )
}

/* ── Data Table ─────────────────────────────────── */
function DataTable({ columns, data }: { columns: { key: string; label: string; format?: (v: any, row?: any) => string | React.ReactNode; align?: string; width?: string }[]; data: any[] }) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[#e8e8ec]">
            {columns.map(col => (
              <th key={col.key} className={`py-3 px-4 text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={`border-b border-[#f4f4f6] hover:bg-[#fafafb] transition-colors ${row._highlight ? 'bg-[#fffbeb]' : ''}`}>
              {columns.map(col => (
                <td key={col.key} className={`py-2.5 px-4 tabular-nums ${col.align === 'right' ? 'text-right' : ''}`}>
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
  contentStyle: { background: '#fff', border: '1px solid #e8e8ec', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
  labelStyle: { color: '#9d9da8' },
}

/* ── Main Tabs ──────────────────────────────────── */
export function ClientTabs({ daily, campaigns, ads, topAds, bottomAds, funnelSteps, ageGender, placement, device, region, resultLabel, isEcom, targetCpl, targetRoas, totalSpend }: ClientTabsProps) {
  const chartData = daily.map(d => ({
    date: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    spend: Math.round(d.spend * 100) / 100,
    results: d.results,
    cpr: d.results > 0 ? Math.round((d.spend / d.results) * 100) / 100 : 0,
    impressions: d.impressions,
    clicks: d.clicks,
  }))

  const tw = daily.slice(-7)
  const lw = daily.slice(-14, -7)
  const twSum = (key: string) => tw.reduce((s, d) => s + (d[key] || 0), 0)
  const lwSum = (key: string) => lw.reduce((s, d) => s + (d[key] || 0), 0)

  // Best day
  const daysWithResults = daily.filter(d => d.results > 0)
  const bestDay = [...daysWithResults].sort((a, b) => (a.spend / a.results) - (b.spend / b.results))[0]

  // Max spend for inline bars
  const maxDailySpend = Math.max(...daily.map(d => d.spend), 1)

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="ads">Ads ({ads.length})</TabsTrigger>
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="daily">Daily</TabsTrigger>
        {ageGender.length > 0 && <TabsTrigger value="audience">Audience</TabsTrigger>}
        {placement.length > 0 && <TabsTrigger value="placements">Placements</TabsTrigger>}
        {region.length > 0 && <TabsTrigger value="geographic">Geographic</TabsTrigger>}
      </TabsList>

      {/* ═══════════ OVERVIEW ═══════════ */}
      <TabsContent value="overview">
        <div className="space-y-5">
          {/* Performance Trend */}
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-4">Performance Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="spendG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="resultsG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f2" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9d9da8' }} axisLine={{ stroke: '#e8e8ec' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9d9da8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9d9da8' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#2563eb" fill="url(#spendG)" name="Spend ($)" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="results" stroke="#16a34a" fill="url(#resultsG)" name={resultLabel} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* 6 Stat Boxes */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatBox label="Spend" value={formatCurrency(twSum('spend'))} icon="$" sparkData={tw.map(d => d.spend)} change={wowChange(twSum('spend'), lwSum('spend'))} />
            <StatBox label={resultLabel} value={formatNumber(twSum('results'))} sparkData={tw.map(d => d.results)} sparkColor="#16a34a" change={wowChange(twSum('results'), lwSum('results'))} />
            <StatBox label="CPR" value={twSum('results') > 0 ? formatCurrency(twSum('spend') / twSum('results')) : '—'} change={wowChangeCPL(twSum('results') > 0 ? twSum('spend')/twSum('results') : 0, lwSum('results') > 0 ? lwSum('spend')/lwSum('results') : 0)} />
            <StatBox label="Impressions" value={formatNumber(twSum('impressions'))} sparkData={tw.map(d => d.impressions)} change={wowChange(twSum('impressions'), lwSum('impressions'))} />
            <StatBox label="Clicks" value={formatNumber(twSum('clicks'))} sparkData={tw.map(d => d.clicks)} change={wowChange(twSum('clicks'), lwSum('clicks'))} />
            <StatBox label="CTR" value={twSum('impressions') > 0 ? formatPercent((twSum('clicks') / twSum('impressions')) * 100) : '—'} change={wowChange(twSum('impressions') > 0 ? (twSum('clicks') / twSum('impressions')) * 100 : 0, lwSum('impressions') > 0 ? (lwSum('clicks') / lwSum('impressions')) * 100 : 0)} />
          </div>

          {/* Top / Bottom */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {topAds.length > 0 && (
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold text-[#16a34a] mb-3">Top Performers</h3>
                <div className="space-y-3">
                  {topAds.map((ad, i) => (
                    <div key={ad.platform_ad_id} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#dcfce7] text-[#16a34a] text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{ad.ad_name}</p>
                        <p className="text-[11px] text-[#9d9da8]">{formatCurrency(ad.spend)} spent · {ad.results} {ad.result_label}</p>
                      </div>
                      <span className="text-[13px] font-bold text-[#16a34a] tabular-nums">{formatCurrency(ad.cpr)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {bottomAds.length > 0 && (
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold text-[#dc2626] mb-3">Underperformers</h3>
                <div className="space-y-3">
                  {bottomAds.map((ad, i) => (
                    <div key={ad.platform_ad_id} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#fef2f2] text-[#dc2626] text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{ad.ad_name}</p>
                        <p className="text-[11px] text-[#9d9da8]">{formatCurrency(ad.spend)} spent · {ad.results} {ad.result_label}</p>
                      </div>
                      <span className="text-[13px] font-bold text-[#dc2626] tabular-nums">{formatCurrency(ad.cpr)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Funnel Health */}
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-4">Funnel Health</h3>
            <div className="flex items-center justify-around mb-5">
              {funnelSteps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[22px] font-bold tabular-nums">{formatNumber(step.value)}</p>
                    <p className="text-[11px] text-[#9d9da8]">{step.label}</p>
                    {step.rate !== undefined && i > 0 && (
                      <p className="text-[11px] text-[#16a34a] font-medium mt-0.5">{step.rateLabel}: {step.rate.toFixed(2)}%</p>
                    )}
                  </div>
                  {i < funnelSteps.length - 1 && (
                    <svg className="w-4 h-4 text-[#d4d4d8]" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4l6 6-6 6" /></svg>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {funnelSteps.map(step => {
                const maxVal = funnelSteps[0].value || 1
                const pct = (step.value / maxVal) * 100
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <span className="text-[11px] text-[#9d9da8] w-20 text-right">{step.label}</span>
                    <div className="flex-1 h-4 bg-[#f4f4f6] rounded-full overflow-hidden">
                      <div className="h-full bg-[#2563eb] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-[#9d9da8] w-16 tabular-nums">{formatNumber(step.value)}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </TabsContent>

      {/* ═══════════ ADS ═══════════ */}
      <TabsContent value="ads">
        <Card>
          <div className="px-5 py-4 border-b border-[#e8e8ec] flex items-center justify-between">
            <h3 className="text-[14px] font-semibold">All Ads · {ads.length}</h3>
            <span className="text-[12px] text-[#9d9da8]">Sort: Spend (High to Low)</span>
          </div>
          <DataTable
            columns={[
              { key: 'ad_name', label: 'Ad', format: (v) => <span className="font-medium">{v}</span> },
              { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
              { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
              { key: 'cpr', label: 'CPR', format: (v: number) => {
                if (v === 0) return <span className="text-[#c4c4cc]">—</span>
                const isOver = targetCpl ? v > targetCpl : false
                return <span className={`font-semibold ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(v)}</span>
              }, align: 'right' },
              { key: 'ctr', label: 'CTR', format: (v: number) => <span className="text-[#6b6b76]">{formatPercent(v)}</span>, align: 'right' },
            ]}
            data={ads}
          />
        </Card>
      </TabsContent>

      {/* ═══════════ CAMPAIGNS ═══════════ */}
      <TabsContent value="campaigns">
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-3">Spend Distribution</h3>
            <div className="space-y-3">
              {campaigns.map(c => {
                const pct = totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0
                return (
                  <div key={c.platform_campaign_id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] truncate max-w-[60%]">{c.campaign_name}</span>
                      <span className="text-[12px] text-[#9d9da8] tabular-nums">{c.results} {resultLabel.toLowerCase()} · {formatCurrency(c.spend)}</span>
                    </div>
                    <div className="h-2 bg-[#f4f4f6] rounded-full overflow-hidden">
                      <div className="h-full bg-[#dc2626] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map(c => (
              <Card key={c.platform_campaign_id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-[13px] font-semibold truncate max-w-[200px]">{c.campaign_name}</h4>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div><span className="text-[#9d9da8]">Spend</span><p className="font-semibold">{formatCurrency(c.spend)}</p></div>
                  <div><span className="text-[#9d9da8]">{resultLabel}</span><p className="font-semibold">{c.results}</p></div>
                  <div><span className="text-[#9d9da8]">CPR</span><p className="font-semibold">{c.cpr > 0 ? formatCurrency(c.cpr) : '—'}</p></div>
                  <div><span className="text-[#9d9da8]">CTR</span><p className="font-semibold">{formatPercent(c.ctr)}</p></div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </TabsContent>

      {/* ═══════════ DAILY ═══════════ */}
      <TabsContent value="daily">
        <div className="space-y-5">
          {/* 4 Stat boxes with sparklines */}
          <div className="grid grid-cols-4 gap-4">
            <StatBox
              label="Total Spend"
              value={formatCurrency(daily.reduce((s, d) => s + d.spend, 0))}
              sub={`~${formatCurrency(daily.reduce((s, d) => s + d.spend, 0) / (daily.length || 1))}/day`}
              icon="$"
              sparkData={daily.map(d => d.spend)}
              change={wowChange(twSum('spend'), lwSum('spend'))}
            />
            <StatBox
              label={`Total ${resultLabel}`}
              value={formatNumber(daily.reduce((s, d) => s + d.results, 0))}
              sub={`~${(daily.reduce((s, d) => s + d.results, 0) / (daily.length || 1)).toFixed(1)}/day`}
              sparkData={daily.map(d => d.results)}
              sparkColor="#16a34a"
              change={wowChange(twSum('results'), lwSum('results'))}
            />
            <StatBox
              label="Avg CPR"
              value={daily.reduce((s, d) => s + d.results, 0) > 0 ? formatCurrency(daily.reduce((s, d) => s + d.spend, 0) / daily.reduce((s, d) => s + d.results, 0)) : '—'}
              sub={`Over ${daily.length} days`}
              sparkData={daily.map(d => d.results > 0 ? d.spend / d.results : 0)}
              sparkColor="#f59e0b"
            />
            {bestDay && (
              <StatBox
                label="Best Day"
                value={new Date(bestDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                sub={`${formatCurrency(bestDay.spend / bestDay.results)} CPR · ${bestDay.results} ${resultLabel.toLowerCase()}`}
                highlight={true}
              />
            )}
          </div>

          {/* Daily Breakdown with inline bars */}
          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec] flex items-center justify-between">
              <h3 className="text-[14px] font-semibold">Daily Breakdown</h3>
              <span className="text-[12px] text-[#9d9da8]">{daily.length} days</span>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#e8e8ec]">
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider" style={{ width: '40%' }}></th>
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Spend</th>
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">{resultLabel}</th>
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPR</th>
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {[...daily].reverse().map((d, i) => {
                    const cpr = d.results > 0 ? d.spend / d.results : 0
                    const isOver = targetCpl ? cpr > targetCpl : false
                    const isBest = bestDay && d.date === bestDay.date
                    const ctrVal = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0
                    const barPct = (d.spend / maxDailySpend) * 100

                    return (
                      <tr key={d.date} className={`border-b border-[#f4f4f6] hover:bg-[#fafafb] transition-colors ${isBest ? 'bg-[#fffbeb]' : ''}`}>
                        <td className="py-2.5 px-4">
                          <span className="text-[#111113]">{new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          {isBest && <span className="ml-1.5 inline-block w-3 h-3 text-[#f59e0b]"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 4v3H4a1 1 0 00-.82 1.57l7 10a1 1 0 001.64 0l7-10A1 1 0 0018 7h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1z" /></svg></span>}
                        </td>
                        <td className="py-2.5 px-4">
                          {/* Inline spend bar */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-[6px] bg-[#f4f4f6] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: d.results > 0 ? '#2563eb' : '#94a3b8' }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-medium">{formatCurrency(d.spend)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{d.results}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {cpr > 0 ? (
                            <span className={`font-semibold ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(cpr)}</span>
                          ) : (
                            <span className="text-[#c4c4cc]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[#6b6b76]">{ctrVal > 0 ? formatPercent(ctrVal) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </TabsContent>

      {/* ═══════════ AUDIENCE ═══════════ */}
      {ageGender.length > 0 && (
        <TabsContent value="audience">
          <div className="space-y-5">
            <Card>
              <div className="px-5 py-4 border-b border-[#e8e8ec]">
                <h3 className="text-[14px] font-semibold">Age & Gender</h3>
              </div>
              <DataTable
                columns={[
                  { key: 'dimension_value', label: 'Segment', format: (v) => <span className="font-medium">{v}</span> },
                  { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                  { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                  { key: 'cpr', label: 'CPR', format: (v: number) => {
                    if (v === 0) return <span className="text-[#c4c4cc]">—</span>
                    const isOver = targetCpl ? v > targetCpl : false
                    return <span className={`font-semibold ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(v)}</span>
                  }, align: 'right' },
                  { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
                  { key: '_pct', label: '% Spend', format: (_, row) => totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—', align: 'right' },
                ]}
                data={ageGender}
              />
            </Card>

            {device.length > 0 && (
              <Card>
                <div className="px-5 py-4 border-b border-[#e8e8ec]">
                  <h3 className="text-[14px] font-semibold">Device Performance</h3>
                </div>
                <DataTable
                  columns={[
                    { key: 'dimension_value', label: 'Device', format: (v) => <span className="font-medium">{v}</span> },
                    { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                    { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                    { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? formatCurrency(v) : '—', align: 'right' },
                    { key: '_pct', label: '% Spend', format: (_, row) => totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—', align: 'right' },
                  ]}
                  data={device}
                />
              </Card>
            )}
          </div>
        </TabsContent>
      )}

      {/* ═══════════ PLACEMENTS ═══════════ */}
      {placement.length > 0 && (
        <TabsContent value="placements">
          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec]">
              <h3 className="text-[14px] font-semibold">All Placements</h3>
            </div>
            <DataTable
              columns={[
                { key: 'dimension_value', label: 'Placement', format: (v) => <span className="font-medium">{v}</span> },
                { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? formatCurrency(v) : '—', align: 'right' },
                { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
                { key: '_pct', label: '% Spend', format: (_, row) => totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—', align: 'right' },
              ]}
              data={placement}
            />
          </Card>
        </TabsContent>
      )}

      {/* ═══════════ GEOGRAPHIC ═══════════ */}
      {region.length > 0 && (
        <TabsContent value="geographic">
          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec]">
              <h3 className="text-[14px] font-semibold">Geographic Performance</h3>
            </div>
            <DataTable
              columns={[
                { key: 'dimension_value', label: 'Region', format: (v) => <span className="font-medium">{v}</span> },
                { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                { key: 'clicks', label: 'Clicks', format: (v) => formatNumber(v), align: 'right' },
                { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
                { key: '_pct', label: '% Spend', format: (_, row) => totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—', align: 'right' },
              ]}
              data={region}
            />
          </Card>
        </TabsContent>
      )}
    </Tabs>
  )
}
