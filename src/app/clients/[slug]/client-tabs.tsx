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

function StatBox({ label, value, sub, change, sparkData }: {
  label: string; value: string; sub?: string; change?: { label: string; positive: boolean }; sparkData?: number[]
}) {
  const max = Math.max(...(sparkData || []), 1)
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">{label}</p>
          <p className="text-xl font-bold tabular-nums text-[#111113]">{value}</p>
          {sub && <p className="text-[11px] text-[#9d9da8] mt-0.5">{sub}</p>}
          {change && change.label !== '—' && (
            <p className={`text-[11px] font-medium mt-1 ${change.positive ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
              {change.label} vs last week
            </p>
          )}
        </div>
      </div>
      {sparkData && sparkData.length > 0 && (
        <div className="mt-2 flex items-end gap-[2px] h-[24px]">
          {sparkData.map((v, i) => (
            <div key={i} className="flex-1 bg-[#2563eb]/20 rounded-sm" style={{ height: `${Math.max((v / max) * 100, 4)}%` }} />
          ))}
        </div>
      )}
    </Card>
  )
}

function DataTable({ columns, data }: { columns: { key: string; label: string; format?: (v: any, row?: any) => string | React.ReactNode; align?: string }[]; data: any[] }) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[#e8e8ec]">
            {columns.map(col => (
              <th key={col.key} className={`py-3 px-4 text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-[#f4f4f6] hover:bg-[#fafafb] transition-colors">
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

          {/* Stat Boxes */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatBox label="Spend" value={formatCurrency(twSum('spend'))} sparkData={tw.map(d => d.spend)} change={wowChange(twSum('spend'), lwSum('spend'))} />
            <StatBox label={resultLabel} value={formatNumber(twSum('results'))} sparkData={tw.map(d => d.results)} change={wowChange(twSum('results'), lwSum('results'))} />
            <StatBox label="CPR" value={twSum('results') > 0 ? formatCurrency(twSum('spend') / twSum('results')) : '—'} change={wowChangeCPL(twSum('results') > 0 ? twSum('spend')/twSum('results') : 0, lwSum('results') > 0 ? lwSum('spend')/lwSum('results') : 0)} />
            <StatBox label="Impressions" value={formatNumber(twSum('impressions'))} sparkData={tw.map(d => d.impressions)} change={wowChange(twSum('impressions'), lwSum('impressions'))} />
            <StatBox label="Clicks" value={formatNumber(twSum('clicks'))} sparkData={tw.map(d => d.clicks)} change={wowChange(twSum('clicks'), lwSum('clicks'))} />
            <StatBox label="CTR" value={twSum('impressions') > 0 ? formatPercent((twSum('clicks') / twSum('impressions')) * 100) : '—'} />
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

          {/* Funnel */}
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-4">Funnel Health</h3>
            <div className="flex items-center justify-around mb-4">
              {funnelSteps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[22px] font-bold tabular-nums">{formatNumber(step.value)}</p>
                    <p className="text-[11px] text-[#9d9da8]">{step.label}</p>
                  </div>
                  {step.rate !== undefined && i > 0 && (
                    <div className="text-center">
                      <p className="text-[11px] text-[#9d9da8]">{step.rateLabel}</p>
                      <p className="text-[13px] font-medium">{step.rate.toFixed(2)}%</p>
                    </div>
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

      {/* ADS */}
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

      {/* CAMPAIGNS */}
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
                <h4 className="text-[13px] font-semibold truncate mb-1">{c.campaign_name}</h4>
                <Badge variant="success">Active</Badge>
                <div className="grid grid-cols-2 gap-2 text-[12px] mt-3">
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

      {/* DAILY */}
      <TabsContent value="daily">
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-3">Daily Results</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f2" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9d9da8' }} axisLine={{ stroke: '#e8e8ec' }} tickLine={false} interval={Math.floor(chartData.length / 10)} />
                <YAxis tick={{ fontSize: 11, fill: '#9d9da8' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="results" fill="#2563eb" radius={[3, 3, 0, 0]} name={resultLabel} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec]">
              <h3 className="text-[14px] font-semibold">Daily Breakdown</h3>
            </div>
            <DataTable
              columns={[
                { key: 'date', label: 'Date', format: (v) => new Date(v + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) },
                { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                { key: 'cpr', label: 'CPR', format: (_: any, row: any) => {
                  if (!row.results) return <span className="text-[#c4c4cc]">—</span>
                  const val = row.spend / row.results
                  const isOver = targetCpl ? val > targetCpl : false
                  return <span className={`font-semibold ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(val)}</span>
                }, align: 'right' },
                { key: 'ctr', label: 'CTR', format: (_: any, row: any) => row.impressions > 0 ? formatPercent((row.clicks / row.impressions) * 100) : '—', align: 'right' },
              ]}
              data={[...daily].reverse()}
            />
          </Card>
        </div>
      </TabsContent>

      {/* AUDIENCE */}
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

      {/* PLACEMENTS */}
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

      {/* GEOGRAPHIC */}
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
