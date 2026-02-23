'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber, formatPercent, formatCompact, wowChange, wowChangeCPL, grade } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
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

/* ── Sparkline ──────────────────────────────────── */
function Spark({ data, color = '#2563eb', h = 32, w = 100 }: { data: number[]; color?: string; h?: number; w?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1); const min = Math.min(...data, 0); const range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
  return <svg width={w} height={h} className="mt-2"><polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" /></svg>
}

/* ── Stat Box ───────────────────────────────────── */
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
          <span className={`text-[11px] font-medium ${change.positive ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{change.label}</span>
        )}
      </div>
      {sparkData && <Spark data={sparkData} color={sparkColor || '#2563eb'} />}
    </Card>
  )
}

/* ── Grade Badge (like old bot) ─────────────────── */
function GradeBadge({ cpr, target }: { cpr: number; target: number | null }) {
  if (!cpr || !target) return <span className="text-[#c4c4cc]">—</span>
  const ratio = cpr / target
  const g = grade(ratio)
  const bgMap: Record<string, string> = { A: 'bg-[#dcfce7] text-[#16a34a]', B: 'bg-[#dbeafe] text-[#2563eb]', C: 'bg-[#fef9c3] text-[#a16207]', D: 'bg-[#ffedd5] text-[#ea580c]', F: 'bg-[#fef2f2] text-[#dc2626]', '—': 'bg-[#f4f4f6] text-[#9d9da8]' }
  return <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${bgMap[g.letter] || bgMap['—']}`}>{g.letter}</span>
}

/* ── Data Table ─────────────────────────────────── */
function DataTable({ columns, data }: { columns: { key: string; label: string; format?: (v: any, row?: any) => string | React.ReactNode; align?: string }[]; data: any[] }) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[#e8e8ec]">
            {columns.map(col => (
              <th key={col.key} className={`py-3 px-4 text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={`border-b border-[#f4f4f6] hover:bg-[#fafafb] transition-colors ${row._highlight ? 'bg-[#fffbeb]' : ''}`}>
              {columns.map(col => (
                <td key={col.key} className={`py-2.5 px-4 tabular-nums ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
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

/* ── MAIN TABS ──────────────────────────────────── */
export function ClientTabs({ daily, campaigns, ads, topAds, bottomAds, funnelSteps, ageGender, placement, device, region, resultLabel, isEcom, targetCpl, targetRoas, totalSpend }: ClientTabsProps) {
  const chartData = daily.map(d => ({
    date: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    spend: Math.round(d.spend * 100) / 100,
    results: d.results,
    cpr: d.results > 0 ? Math.round((d.spend / d.results) * 100) / 100 : 0,
    impressions: d.impressions,
    clicks: d.clicks,
  }))

  const tw = daily.slice(-7); const lw = daily.slice(-14, -7)
  const twSum = (key: string) => tw.reduce((s, d) => s + (d[key] || 0), 0)
  const lwSum = (key: string) => lw.reduce((s, d) => s + (d[key] || 0), 0)
  const daysWithResults = daily.filter(d => d.results > 0)
  const bestDay = [...daysWithResults].sort((a, b) => (a.spend / a.results) - (b.spend / b.results))[0]
  const maxDailySpend = Math.max(...daily.map(d => d.spend), 1)

  // Audience processing
  const totalResults = daily.reduce((s, d) => s + d.results, 0)
  const audienceTotal = { spend: 0, results: 0, impressions: 0, clicks: 0 }
  ageGender.forEach(r => { audienceTotal.spend += r.spend; audienceTotal.results += r.results; audienceTotal.impressions += r.impressions; audienceTotal.clicks += r.clicks })
  const bestAudienceSegment = [...ageGender].filter(a => a.results > 0).sort((a, b) => a.cpr - b.cpr)[0]
  const worstAudienceSegments = [...ageGender].filter(a => a.results > 0 && a.cpr > 0).sort((a, b) => b.cpr - a.cpr).slice(0, 3)
  const topAudienceSegments = [...ageGender].filter(a => a.results > 0 && a.cpr > 0).sort((a, b) => a.cpr - b.cpr).slice(0, 3)

  // Placement processing
  const placementTotal = { spend: 0, results: 0 }
  placement.forEach(p => { placementTotal.spend += p.spend; placementTotal.results += p.results })
  const bestPlacement = [...placement].filter(p => p.results > 0).sort((a, b) => a.cpr - b.cpr)[0]
  const topPlacements = [...placement].filter(p => p.results > 0).sort((a, b) => a.cpr - b.cpr).slice(0, 5)
  const worstPlacements = [...placement].filter(p => p.results > 0).sort((a, b) => b.cpr - a.cpr).slice(0, 5)
  const maxPlacementSpend = Math.max(...placement.map(p => p.spend), 1)

  // Platform aggregation for placements donut
  const platformSpend: Record<string, number> = {}
  placement.forEach(p => {
    const platform = p.dimension_value?.split(' ')[0] || 'Other'
    platformSpend[platform] = (platformSpend[platform] || 0) + p.spend
  })
  const platformData = Object.entries(platformSpend).sort((a, b) => b[1] - a[1]).map(([name, spend]) => ({ name, spend }))
  const platformColors = ['#2563eb', '#dc2626', '#f59e0b', '#16a34a', '#8b5cf6']

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

      {/* ═══════════════════ OVERVIEW ═══════════════════ */}
      <TabsContent value="overview">
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-4">Performance Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="spendG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.12} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient>
                  <linearGradient id="resultsG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16a34a" stopOpacity={0.12} /><stop offset="100%" stopColor="#16a34a" stopOpacity={0} /></linearGradient>
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

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatBox label="Spend" value={formatCurrency(twSum('spend'))} icon="$" sparkData={tw.map(d => d.spend)} change={wowChange(twSum('spend'), lwSum('spend'))} />
            <StatBox label={resultLabel} value={formatNumber(twSum('results'))} sparkData={tw.map(d => d.results)} sparkColor="#16a34a" change={wowChange(twSum('results'), lwSum('results'))} />
            <StatBox label="CPR" value={twSum('results') > 0 ? formatCurrency(twSum('spend') / twSum('results')) : '—'} change={wowChangeCPL(twSum('results') > 0 ? twSum('spend')/twSum('results') : 0, lwSum('results') > 0 ? lwSum('spend')/lwSum('results') : 0)} />
            <StatBox label="Impressions" value={formatNumber(twSum('impressions'))} sparkData={tw.map(d => d.impressions)} change={wowChange(twSum('impressions'), lwSum('impressions'))} />
            <StatBox label="Clicks" value={formatNumber(twSum('clicks'))} sparkData={tw.map(d => d.clicks)} change={wowChange(twSum('clicks'), lwSum('clicks'))} />
            <StatBox label="CTR" value={twSum('impressions') > 0 ? formatPercent((twSum('clicks') / twSum('impressions')) * 100) : '—'} />
          </div>

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

          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-4">Funnel Health</h3>
            <div className="flex items-center justify-around mb-5">
              {funnelSteps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[22px] font-bold tabular-nums">{formatNumber(step.value)}</p>
                    <p className="text-[11px] text-[#9d9da8]">{step.label}</p>
                    {step.rate !== undefined && i > 0 && <p className="text-[11px] text-[#16a34a] font-medium mt-0.5">{step.rateLabel}: {step.rate.toFixed(2)}%</p>}
                  </div>
                  {i < funnelSteps.length - 1 && <svg className="w-4 h-4 text-[#d4d4d8]" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4l6 6-6 6" /></svg>}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {funnelSteps.map(step => {
                const maxVal = funnelSteps[0].value || 1
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <span className="text-[11px] text-[#9d9da8] w-20 text-right">{step.label}</span>
                    <div className="flex-1 h-4 bg-[#f4f4f6] rounded-full overflow-hidden">
                      <div className="h-full bg-[#2563eb] rounded-full" style={{ width: `${(step.value / maxVal) * 100}%` }} />
                    </div>
                    <span className="text-[11px] text-[#9d9da8] w-16 tabular-nums">{formatNumber(step.value)}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </TabsContent>

      {/* ═══════════════════ ADS ═══════════════════ */}
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
              { key: '_grade', label: 'Grade', format: (_, row) => <GradeBadge cpr={row.cpr} target={targetCpl} />, align: 'center' },
            ]}
            data={ads}
          />
        </Card>
      </TabsContent>

      {/* ═══════════════════ CAMPAIGNS ═══════════════════ */}
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
                  <GradeBadge cpr={c.cpr} target={targetCpl} />
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

      {/* ═══════════════════ DAILY ═══════════════════ */}
      <TabsContent value="daily">
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            <StatBox label="Total Spend" value={formatCurrency(daily.reduce((s, d) => s + d.spend, 0))} sub={`~${formatCurrency(daily.reduce((s, d) => s + d.spend, 0) / (daily.length || 1))}/day`} icon="$" sparkData={daily.map(d => d.spend)} change={wowChange(twSum('spend'), lwSum('spend'))} />
            <StatBox label={`Total ${resultLabel}`} value={formatNumber(daily.reduce((s, d) => s + d.results, 0))} sub={`~${(daily.reduce((s, d) => s + d.results, 0) / (daily.length || 1)).toFixed(1)}/day`} sparkData={daily.map(d => d.results)} sparkColor="#16a34a" change={wowChange(twSum('results'), lwSum('results'))} />
            <StatBox label="Avg CPR" value={totalResults > 0 ? formatCurrency(daily.reduce((s, d) => s + d.spend, 0) / totalResults) : '—'} sub={`Over ${daily.length} days`} sparkData={daily.map(d => d.results > 0 ? d.spend / d.results : 0)} sparkColor="#f59e0b" />
            {bestDay && <StatBox label="Best Day" value={new Date(bestDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} sub={`${formatCurrency(bestDay.spend / bestDay.results)} CPR · ${bestDay.results} ${resultLabel.toLowerCase()}`} highlight={true} />}
          </div>

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
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider" style={{ width: '35%' }}></th>
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Spend</th>
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">{resultLabel}</th>
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPR</th>
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {[...daily].reverse().map(d => {
                    const cpr = d.results > 0 ? d.spend / d.results : 0
                    const isOver = targetCpl ? cpr > targetCpl : false
                    const isBest = bestDay && d.date === bestDay.date
                    const ctrVal = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0
                    return (
                      <tr key={d.date} className={`border-b border-[#f4f4f6] hover:bg-[#fafafb] ${isBest ? 'bg-[#fffbeb]' : ''}`}>
                        <td className="py-2.5 px-4">{new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                        <td className="py-2.5 px-4"><div className="h-[6px] bg-[#f4f4f6] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(d.spend / maxDailySpend) * 100}%`, backgroundColor: d.results > 0 ? '#2563eb' : '#94a3b8' }} /></div></td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-medium">{formatCurrency(d.spend)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{d.results}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{cpr > 0 ? <span className={`font-semibold ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(cpr)}</span> : <span className="text-[#c4c4cc]">—</span>}</td>
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

      {/* ═══════════════════ AUDIENCE ═══════════════════ */}
      {ageGender.length > 0 && (
        <TabsContent value="audience">
          <div className="space-y-5">
            {/* Demographics Overview */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-[14px] font-semibold">Demographics Overview</h3>
                  {targetCpl && audienceTotal.results > 0 && <GradeBadge cpr={audienceTotal.spend / audienceTotal.results} target={targetCpl} />}
                </div>
                <p className="text-[11px] text-[#9d9da8]">{ageGender.length} segments</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3 text-[12px]">
                  <div><span className="text-[#9d9da8]">Total Spend</span><p className="font-bold text-[16px]">{formatCompact(audienceTotal.spend)}</p></div>
                  <div><span className="text-[#9d9da8]">Conversions</span><p className="font-bold text-[16px]">{audienceTotal.results}</p></div>
                  <div><span className="text-[#9d9da8]">Overall CPR</span><p className="font-semibold">{audienceTotal.results > 0 ? formatCurrency(audienceTotal.spend / audienceTotal.results) : '—'} {targetCpl && audienceTotal.results > 0 ? <span className={`text-[11px] ${(audienceTotal.spend / audienceTotal.results) > targetCpl ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>({targetCpl ? `${(((audienceTotal.spend / audienceTotal.results) / targetCpl - 1) * 100).toFixed(0)}% vs target` : ''})</span> : ''}</p></div>
                  <div><span className="text-[#9d9da8]">Target CPR</span><p className="font-semibold">{targetCpl ? formatCurrency(targetCpl) : '—'}</p></div>
                </div>
                {bestAudienceSegment && (
                  <div className="mt-3 pt-3 border-t border-[#e8e8ec]">
                    <p className="text-[11px] text-[#9d9da8]">Best Performer</p>
                    <p className="text-[13px] font-semibold text-[#16a34a]">{bestAudienceSegment.dimension_value}</p>
                    <p className="text-[12px] text-[#9d9da8]">{formatCurrency(bestAudienceSegment.cpr)} CPR</p>
                  </div>
                )}
              </Card>

              {/* Spend by Age Group — horizontal bars */}
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold mb-3">Spend by Segment</h3>
                <div className="space-y-2">
                  {ageGender.slice(0, 8).map(seg => {
                    const maxSeg = ageGender[0]?.spend || 1
                    return (
                      <div key={seg.dimension_value}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] truncate max-w-[50%]">{seg.dimension_value}</span>
                          <span className="text-[11px] text-[#9d9da8] tabular-nums">{seg.results} {resultLabel.toLowerCase()} · {formatCurrency(seg.spend)}</span>
                        </div>
                        <div className="h-4 bg-[#f4f4f6] rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${(seg.spend / maxSeg) * 100}%`, backgroundColor: seg.dimension_value?.includes('female') ? '#dc2626' : seg.dimension_value?.includes('male') ? '#2563eb' : '#f59e0b' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* Device Performance */}
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold mb-3">Device Performance</h3>
                <div className="space-y-3">
                  {device.map(d => (
                    <div key={d.dimension_value} className="p-3 rounded-lg bg-[#f8f8fa] border border-[#e8e8ec]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#2563eb]" />
                        <span className="text-[13px] font-medium">{d.dimension_value}</span>
                      </div>
                      <p className="text-[18px] font-bold tabular-nums">{formatCurrency(d.spend)}</p>
                      <p className="text-[11px] text-[#9d9da8]">{d.results} {resultLabel.toLowerCase()} · CPR: {d.cpr > 0 ? formatCurrency(d.cpr) : '—'}</p>
                      <p className="text-[11px] text-[#9d9da8]">{totalSpend > 0 ? ((d.spend / totalSpend) * 100).toFixed(1) : 0}% of spend</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Performance Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {topAudienceSegments.length > 0 && (
                <Card className="p-5">
                  <h3 className="text-[14px] font-semibold text-[#16a34a] mb-3">Best Performers</h3>
                  <div className="space-y-3">
                    {topAudienceSegments.map((seg, i) => (
                      <div key={seg.dimension_value} className="flex items-center gap-3 p-3 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0]">
                        <span className="w-6 h-6 rounded-full bg-[#16a34a] text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium">{seg.dimension_value}</p>
                            <GradeBadge cpr={seg.cpr} target={targetCpl} />
                          </div>
                          <p className="text-[11px] text-[#6b6b76]">{seg.results} {resultLabel.toLowerCase()} · {((seg.spend / totalSpend) * 100).toFixed(1)}% spend</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[14px] font-bold tabular-nums">{formatCurrency(seg.cpr)}</p>
                          {targetCpl && <p className="text-[11px] text-[#16a34a]">{(((seg.cpr / targetCpl) - 1) * 100).toFixed(0)}% vs target</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              {worstAudienceSegments.length > 0 && (
                <Card className="p-5">
                  <h3 className="text-[14px] font-semibold text-[#dc2626] mb-3">Needs Attention</h3>
                  <div className="space-y-3">
                    {worstAudienceSegments.map((seg, i) => {
                      const potentialSavings = targetCpl && seg.cpr > targetCpl ? (seg.cpr - targetCpl) * seg.results : 0
                      return (
                        <div key={seg.dimension_value} className="flex items-center gap-3 p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
                          <span className="w-6 h-6 rounded-full bg-[#dc2626] text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-medium">{seg.dimension_value}</p>
                              <GradeBadge cpr={seg.cpr} target={targetCpl} />
                            </div>
                            <p className="text-[11px] text-[#6b6b76]">{seg.results} {resultLabel.toLowerCase()} · {((seg.spend / totalSpend) * 100).toFixed(1)}% spend</p>
                            {potentialSavings > 0 && <p className="text-[11px] text-[#dc2626]">Potential savings: {formatCurrency(potentialSavings)}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-[14px] font-bold tabular-nums">{formatCurrency(seg.cpr)}</p>
                            {targetCpl && <p className="text-[11px] text-[#dc2626]">+{(((seg.cpr / targetCpl) - 1) * 100).toFixed(0)}% vs target</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}
            </div>

            {/* Detailed Breakdown Table */}
            <Card>
              <div className="px-5 py-4 border-b border-[#e8e8ec]">
                <h3 className="text-[14px] font-semibold">Detailed Breakdown</h3>
              </div>
              <DataTable
                columns={[
                  { key: 'dimension_value', label: 'Segment', format: (v) => <span className="font-medium">{v}</span> },
                  { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                  { key: 'impressions', label: 'Impressions', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'clicks', label: 'Clicks', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                  { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
                  { key: 'cpr', label: 'CPR', format: (v: number, row: any) => {
                    if (v === 0) return <span className="text-[#c4c4cc]">—</span>
                    const isOver = targetCpl ? v > targetCpl : false
                    const pctVsTarget = targetCpl ? ` (${v > targetCpl ? '+' : ''}${(((v / targetCpl) - 1) * 100).toFixed(0)}%)` : ''
                    return <><span className={`font-semibold ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(v)}</span>{pctVsTarget && <span className={`text-[10px] ml-1 ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{pctVsTarget}</span>}</>
                  }, align: 'right' },
                  { key: '_grade', label: 'Grade', format: (_, row) => <GradeBadge cpr={row.cpr} target={targetCpl} />, align: 'center' },
                  { key: '_pct', label: '% Total', format: (_, row) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
                ]}
                data={ageGender}
              />
            </Card>
          </div>
        </TabsContent>
      )}

      {/* ═══════════════════ PLACEMENTS ═══════════════════ */}
      {placement.length > 0 && (
        <TabsContent value="placements">
          <div className="space-y-5">
            {/* Overview + Platform + Distribution */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-[14px] font-semibold">Placements Overview</h3>
                  {targetCpl && placementTotal.results > 0 && <GradeBadge cpr={placementTotal.spend / placementTotal.results} target={targetCpl} />}
                </div>
                <p className="text-[11px] text-[#9d9da8]">{placement.length} active placements</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3 text-[12px]">
                  <div><span className="text-[#9d9da8]">Total Spend</span><p className="font-bold text-[16px]">{formatCompact(placementTotal.spend)}</p></div>
                  <div><span className="text-[#9d9da8]">Overall CPR</span><p className="font-bold text-[16px]">{placementTotal.results > 0 ? formatCurrency(placementTotal.spend / placementTotal.results) : '—'}</p></div>
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
                <h3 className="text-[14px] font-semibold mb-3">Spend by Platform</h3>
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
                <h3 className="text-[14px] font-semibold mb-3">Spend Distribution</h3>
                <div className="space-y-2">
                  {placement.slice(0, 6).map(p => (
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

            {/* Top Placements Chart */}
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold mb-3">Top Placements</h3>
              <div className="space-y-2">
                {placement.slice(0, 12).map(p => (
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

            {/* Performance Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold text-[#16a34a] mb-3">Top Performers</h3>
                <div className="space-y-2">
                  {topPlacements.map((p, i) => (
                    <div key={p.dimension_value} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded bg-[#dcfce7] text-[#16a34a] text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-[12px] flex-1 truncate">{p.dimension_value}</span>
                      <span className="text-[12px] font-bold tabular-nums">{formatCurrency(p.cpr)}</span>
                      <GradeBadge cpr={p.cpr} target={targetCpl} />
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold text-[#dc2626] mb-3">Needs Attention</h3>
                <div className="space-y-2">
                  {worstPlacements.map((p, i) => (
                    <div key={p.dimension_value} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded bg-[#fef2f2] text-[#dc2626] text-[10px] font-bold flex items-center justify-center">{placement.length - i}</span>
                      <span className="text-[12px] flex-1 truncate">{p.dimension_value}</span>
                      <span className="text-[12px] font-bold tabular-nums">{formatCurrency(p.cpr)}</span>
                      <GradeBadge cpr={p.cpr} target={targetCpl} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* All Placements Table */}
            <Card>
              <div className="px-5 py-4 border-b border-[#e8e8ec]">
                <h3 className="text-[14px] font-semibold">All Placements</h3>
              </div>
              <DataTable
                columns={[
                  { key: 'dimension_value', label: 'Placement', format: (v) => <span className="font-medium">{v}</span> },
                  { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                  { key: 'impressions', label: 'Impressions', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'clicks', label: 'Clicks', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                  { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
                  { key: 'cpr', label: 'CPR', format: (v: number) => {
                    if (v === 0) return <span className="text-[#c4c4cc]">—</span>
                    const isOver = targetCpl ? v > targetCpl : false
                    return <span className={`font-semibold ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(v)}</span>
                  }, align: 'right' },
                  { key: '_grade', label: 'Grade', format: (_, row) => <GradeBadge cpr={row.cpr} target={targetCpl} />, align: 'center' },
                  { key: '_pct', label: '% Total', format: (_, row) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
                ]}
                data={placement}
              />
            </Card>
          </div>
        </TabsContent>
      )}

      {/* ═══════════════════ GEOGRAPHIC ═══════════════════ */}
      {region.length > 0 && (
        <TabsContent value="geographic">
          <div className="space-y-5">
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold mb-3">Top Regions by Spend</h3>
              <div className="space-y-2">
                {region.slice(0, 10).map(r => {
                  const maxR = region[0]?.spend || 1
                  return (
                    <div key={r.dimension_value} className="flex items-center gap-3">
                      <span className="text-[11px] font-medium w-8">{r.dimension_value?.slice(0, 2).toUpperCase()}</span>
                      <span className="text-[11px] text-[#6b6b76] truncate w-28">{r.dimension_value}</span>
                      <div className="flex-1 h-5 bg-[#f4f4f6] rounded overflow-hidden">
                        <div className="h-full bg-[#f59e0b] rounded" style={{ width: `${(r.spend / maxR) * 100}%` }} />
                      </div>
                      <span className="text-[11px] tabular-nums w-16 text-right">{formatCurrency(r.spend)}</span>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card>
              <div className="px-5 py-4 border-b border-[#e8e8ec]">
                <h3 className="text-[14px] font-semibold">All Regions</h3>
              </div>
              <DataTable
                columns={[
                  { key: 'dimension_value', label: 'Region', format: (v) => <span className="font-medium">{v}</span> },
                  { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                  { key: 'impressions', label: 'Impressions', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'clicks', label: 'Clicks', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
                  { key: '_pct', label: '% Spend', format: (_, row) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
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
