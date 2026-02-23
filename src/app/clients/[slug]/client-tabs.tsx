'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
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

function StatBox({ label, value, sub, change }: {
  label: string; value: string; sub?: string; change?: { label: string; positive: boolean }
}) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-white">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {sub && <p className="text-[11px] text-zinc-500">{sub}</p>}
        {change && change.label !== '—' && (
          <span className={`text-[11px] font-medium ${change.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {change.label}
          </span>
        )}
      </div>
    </div>
  )
}

function DataTable({ columns, data }: { columns: { key: string; label: string; format?: (v: any, row?: any) => string | React.ReactNode; align?: string }[]; data: any[] }) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-zinc-800/50">
            {columns.map(col => (
              <th key={col.key} className={`py-3 px-4 text-[11px] text-zinc-500 font-medium uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-zinc-800/20 hover:bg-zinc-800/20 transition-colors">
              {columns.map(col => (
                <td key={col.key} className={`py-3 px-4 tabular-nums ${col.align === 'right' ? 'text-right' : ''}`}>
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
  contentStyle: { background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' },
  labelStyle: { color: '#a1a1aa' },
  itemStyle: { color: '#fafafa' },
}

export function ClientTabs({ daily, campaigns, ads, topAds, bottomAds, ageGender, placement, device, region, resultLabel, isEcom, targetCpl, targetRoas, totalSpend }: ClientTabsProps) {
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

      {/* OVERVIEW */}
      <TabsContent value="overview">
        <div className="space-y-6">
          {/* Trend Chart */}
          <Card className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">Performance Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="resultsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={{ stroke: '#27272a' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#3b82f6" fill="url(#spendGrad)" name="Spend ($)" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="results" stroke="#22c55e" fill="url(#resultsGrad)" name={resultLabel} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatBox label="Spend" value={formatCurrency(twSum('spend'))} change={wowChange(twSum('spend'), lwSum('spend'))} />
            <StatBox label={resultLabel} value={formatNumber(twSum('results'))} change={wowChange(twSum('results'), lwSum('results'))} />
            <StatBox label="CPR" value={twSum('results') > 0 ? formatCurrency(twSum('spend') / twSum('results')) : '—'} change={wowChangeCPL(twSum('results') > 0 ? twSum('spend')/twSum('results') : 0, lwSum('results') > 0 ? lwSum('spend')/lwSum('results') : 0)} />
            <StatBox label="Impressions" value={formatNumber(twSum('impressions'))} change={wowChange(twSum('impressions'), lwSum('impressions'))} />
            <StatBox label="Clicks" value={formatNumber(twSum('clicks'))} change={wowChange(twSum('clicks'), lwSum('clicks'))} />
            <StatBox label="CTR" value={twSum('impressions') > 0 ? formatPercent((twSum('clicks') / twSum('impressions')) * 100) : '—'} />
          </div>

          {/* Top / Bottom Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {topAds.length > 0 && (
              <Card className="p-5">
                <h3 className="text-sm font-medium text-emerald-400 mb-4">Top Performers</h3>
                <div className="space-y-3">
                  {topAds.map((ad, i) => (
                    <div key={ad.platform_ad_id} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-white truncate">{ad.ad_name}</p>
                        <p className="text-[11px] text-zinc-500">{formatCurrency(ad.spend)} spent · {ad.results} {ad.result_label}</p>
                      </div>
                      <span className="text-[13px] font-semibold text-emerald-400 tabular-nums">{formatCurrency(ad.cpr)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {bottomAds.length > 0 && (
              <Card className="p-5">
                <h3 className="text-sm font-medium text-red-400 mb-4">Underperformers</h3>
                <div className="space-y-3">
                  {bottomAds.map((ad, i) => (
                    <div key={ad.platform_ad_id} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 text-[11px] font-semibold flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-white truncate">{ad.ad_name}</p>
                        <p className="text-[11px] text-zinc-500">{formatCurrency(ad.spend)} spent · {ad.results} {ad.result_label}</p>
                      </div>
                      <span className="text-[13px] font-semibold text-red-400 tabular-nums">{formatCurrency(ad.cpr)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </TabsContent>

      {/* ADS */}
      <TabsContent value="ads">
        <Card>
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-medium text-white">All Ads</h3>
          </div>
          <DataTable
            columns={[
              { key: 'ad_name', label: 'Ad', format: (v) => <span className="font-medium text-white">{v}</span> },
              { key: 'campaign_name', label: 'Campaign', format: (v) => <span className="text-zinc-400 text-[12px]">{v}</span> },
              { key: 'spend', label: 'Spend', format: (v) => <span className="text-white">{formatCurrency(v)}</span>, align: 'right' },
              { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
              { key: 'cpr', label: 'CPR', format: (v: number) => {
                if (v === 0) return <span className="text-zinc-600">—</span>
                const isOver = targetCpl ? v > targetCpl : false
                return <span className={`font-semibold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(v)}</span>
              }, align: 'right' },
              { key: 'ctr', label: 'CTR', format: (v: number) => <span className="text-zinc-400">{formatPercent(v)}</span>, align: 'right' },
            ]}
            data={ads}
          />
        </Card>
      </TabsContent>

      {/* CAMPAIGNS */}
      <TabsContent value="campaigns">
        <div className="space-y-6">
          {/* Spend distribution */}
          <Card className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">Spend Distribution</h3>
            <div className="space-y-3">
              {campaigns.map(c => {
                const pct = totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0
                return (
                  <div key={c.platform_campaign_id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-zinc-300 truncate max-w-[60%]">{c.campaign_name}</span>
                      <span className="text-[12px] text-zinc-400 tabular-nums">{formatCurrency(c.spend)} · {c.results} {resultLabel.toLowerCase()}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Campaign table */}
          <Card>
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-white">All Campaigns</h3>
            </div>
            <DataTable
              columns={[
                { key: 'campaign_name', label: 'Campaign', format: (v) => <span className="font-medium text-white">{v}</span> },
                { key: 'spend', label: 'Spend', format: (v) => <span className="text-white">{formatCurrency(v)}</span>, align: 'right' },
                { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                { key: 'cpr', label: 'CPR', format: (v: number) => {
                  if (v === 0) return <span className="text-zinc-600">—</span>
                  const isOver = targetCpl ? v > targetCpl : false
                  return <span className={`font-semibold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(v)}</span>
                }, align: 'right' },
                { key: 'ctr', label: 'CTR', format: (v: number) => <span className="text-zinc-400">{formatPercent(v)}</span>, align: 'right' },
              ]}
              data={campaigns}
            />
          </Card>
        </div>
      </TabsContent>

      {/* DAILY */}
      <TabsContent value="daily">
        <div className="space-y-6">
          {/* Daily chart */}
          <Card className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">Daily Results</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={{ stroke: '#27272a' }} tickLine={false} interval={Math.floor(chartData.length / 10)} />
                <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="results" fill="#3b82f6" radius={[3, 3, 0, 0]} name={resultLabel} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Daily table */}
          <Card>
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-white">Daily Breakdown</h3>
            </div>
            <DataTable
              columns={[
                { key: 'date', label: 'Date', format: (v) => <span className="text-zinc-300">{new Date(v + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span> },
                { key: 'spend', label: 'Spend', format: (v) => <span className="text-white">{formatCurrency(v)}</span>, align: 'right' },
                { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                { key: 'cpr', label: 'CPR', format: (_: any, row: any) => {
                  if (!row.results) return <span className="text-zinc-600">—</span>
                  const val = row.spend / row.results
                  const isOver = targetCpl ? val > targetCpl : false
                  return <span className={`font-semibold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(val)}</span>
                }, align: 'right' },
                { key: 'impressions', label: 'Impressions', format: (v) => <span className="text-zinc-400">{formatNumber(v)}</span>, align: 'right' },
                { key: 'ctr', label: 'CTR', format: (_: any, row: any) => <span className="text-zinc-400">{row.impressions > 0 ? formatPercent((row.clicks / row.impressions) * 100) : '—'}</span>, align: 'right' },
              ]}
              data={[...daily].reverse()}
            />
          </Card>
        </div>
      </TabsContent>

      {/* AUDIENCE */}
      {ageGender.length > 0 && (
        <TabsContent value="audience">
          <div className="space-y-6">
            <Card>
              <div className="px-5 py-4 border-b border-zinc-800">
                <h3 className="text-sm font-medium text-white">Age & Gender</h3>
              </div>
              <DataTable
                columns={[
                  { key: 'dimension_value', label: 'Segment', format: (v) => <span className="font-medium text-white">{v}</span> },
                  { key: 'spend', label: 'Spend', format: (v) => <span className="text-white">{formatCurrency(v)}</span>, align: 'right' },
                  { key: 'impressions', label: 'Impressions', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                  { key: 'cpr', label: 'CPR', format: (v: number) => {
                    if (v === 0) return <span className="text-zinc-600">—</span>
                    const isOver = targetCpl ? v > targetCpl : false
                    return <span className={`font-semibold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(v)}</span>
                  }, align: 'right' },
                  { key: 'ctr', label: 'CTR', format: (v: number) => <span className="text-zinc-400">{formatPercent(v)}</span>, align: 'right' },
                  { key: '_pct', label: '% of Spend', format: (_, row) => <span className="text-zinc-500">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
                ]}
                data={ageGender}
              />
            </Card>

            {device.length > 0 && (
              <Card>
                <div className="px-5 py-4 border-b border-zinc-800">
                  <h3 className="text-sm font-medium text-white">Device Performance</h3>
                </div>
                <DataTable
                  columns={[
                    { key: 'dimension_value', label: 'Device', format: (v) => <span className="font-medium text-white">{v}</span> },
                    { key: 'spend', label: 'Spend', format: (v) => <span className="text-white">{formatCurrency(v)}</span>, align: 'right' },
                    { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                    { key: 'cpr', label: 'CPR', format: (v: number) => {
                      if (v === 0) return <span className="text-zinc-600">—</span>
                      return <span className="font-semibold text-white">{formatCurrency(v)}</span>
                    }, align: 'right' },
                    { key: '_pct', label: '% of Spend', format: (_, row) => <span className="text-zinc-500">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
                  ]}
                  data={device}
                />
              </Card>
            )}
          </div>
        </TabsContent>
      )}

      {/* PLACEMENTS */}
      {placement.length > 0 && (
        <TabsContent value="placements">
          <Card>
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-white">All Placements</h3>
            </div>
            <DataTable
              columns={[
                { key: 'dimension_value', label: 'Placement', format: (v) => <span className="font-medium text-white">{v}</span> },
                { key: 'spend', label: 'Spend', format: (v) => <span className="text-white">{formatCurrency(v)}</span>, align: 'right' },
                { key: 'impressions', label: 'Impressions', format: (v) => formatNumber(v), align: 'right' },
                { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? formatCurrency(v) : '—', align: 'right' },
                { key: 'ctr', label: 'CTR', format: (v: number) => <span className="text-zinc-400">{formatPercent(v)}</span>, align: 'right' },
                { key: '_pct', label: '% of Spend', format: (_, row) => <span className="text-zinc-500">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
              ]}
              data={placement}
            />
          </Card>
        </TabsContent>
      )}

      {/* GEOGRAPHIC */}
      {region.length > 0 && (
        <TabsContent value="geographic">
          <Card>
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-white">Geographic Performance</h3>
            </div>
            <DataTable
              columns={[
                { key: 'dimension_value', label: 'Region', format: (v) => <span className="font-medium text-white">{v}</span> },
                { key: 'spend', label: 'Spend', format: (v) => <span className="text-white">{formatCurrency(v)}</span>, align: 'right' },
                { key: 'impressions', label: 'Impressions', format: (v) => formatNumber(v), align: 'right' },
                { key: 'clicks', label: 'Clicks', format: (v) => formatNumber(v), align: 'right' },
                { key: 'ctr', label: 'CTR', format: (v: number) => <span className="text-zinc-400">{formatPercent(v)}</span>, align: 'right' },
                { key: '_pct', label: '% of Spend', format: (_, row) => <span className="text-zinc-500">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
              ]}
              data={region}
            />
          </Card>
        </TabsContent>
      )}
    </Tabs>
  )
}
