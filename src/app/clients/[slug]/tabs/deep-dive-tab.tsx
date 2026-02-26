'use client'

import { Card } from '@/components/ui/card'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

interface DeepDiveTabProps {
  daily: any[]
  campaigns: any[]
  ads: any[]
  pacingData: { monthSpend: number; monthResults: number; avgDaily: number; projected: number; projectedResults: number; dayOfMonth: number; daysInMonth: number; daysRemaining: number }
  resultLabel: string
  targetCpl: number | null
  totalSpend: number
}

export function DeepDiveTab({ daily, campaigns, ads, pacingData, resultLabel, targetCpl, totalSpend }: DeepDiveTabProps) {
  const totalSpendAll = daily.reduce((s: number, d: any) => s + d.spend, 0)
  const totalResultsAll = daily.reduce((s: number, d: any) => s + d.results, 0)
  const totalImpressions = daily.reduce((s: number, d: any) => s + d.impressions, 0)
  const totalClicks = daily.reduce((s: number, d: any) => s + d.clicks, 0)
  const overallCpr = totalResultsAll > 0 ? totalSpendAll / totalResultsAll : 0
  const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const convRate = totalClicks > 0 ? (totalResultsAll / totalClicks) * 100 : 0
  const costPerClick = totalClicks > 0 ? totalSpendAll / totalClicks : 0
  const cpm = totalImpressions > 0 ? (totalSpendAll / totalImpressions) * 1000 : 0
  const lpvTotal = daily.reduce((s: number, d: any) => s + (d.landing_page_views || 0), 0)
  const lpvRate = totalClicks > 0 ? (lpvTotal / totalClicks) * 100 : 0
  const daysWithResults = daily.filter((d: any) => d.results > 0)

  // Day-of-week analysis
  const dowData: Record<string, { spend: number; results: number; impressions: number; clicks: number; days: number }> = {}
  const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  daily.forEach((d: any) => {
    const dow = dowNames[new Date(d.date + 'T12:00:00').getDay()]
    if (!dowData[dow]) dowData[dow] = { spend: 0, results: 0, impressions: 0, clicks: 0, days: 0 }
    dowData[dow].spend += d.spend; dowData[dow].results += d.results
    dowData[dow].impressions += d.impressions; dowData[dow].clicks += d.clicks; dowData[dow].days++
  })
  const dowArray = dowNames.map(name => {
    const d = dowData[name] || { spend: 0, results: 0, impressions: 0, clicks: 0, days: 0 }
    return { name: name.slice(0, 3), fullName: name, ...d, avgSpend: d.days > 0 ? d.spend / d.days : 0, avgResults: d.days > 0 ? d.results / d.days : 0, cpr: d.results > 0 ? d.spend / d.results : 0, ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0 }
  })
  const bestDow = [...dowArray].filter(d => d.results > 0).sort((a, b) => a.cpr - b.cpr)[0]
  const worstDow = [...dowArray].filter(d => d.results > 0).sort((a, b) => b.cpr - a.cpr)[0]

  // Week-over-week trends
  const weeklyData: { week: string; spend: number; results: number; cpr: number }[] = []
  for (let w = 0; w < Math.min(4, Math.ceil(daily.length / 7)); w++) {
    const slice = daily.slice(-(w + 1) * 7, w === 0 ? undefined : -w * 7)
    const wSpend = slice.reduce((s: number, d: any) => s + d.spend, 0)
    const wResults = slice.reduce((s: number, d: any) => s + d.results, 0)
    weeklyData.unshift({ week: `W${Math.min(4, Math.ceil(daily.length / 7)) - w}`, spend: wSpend, results: wResults, cpr: wResults > 0 ? wSpend / wResults : 0 })
  }

  // Campaign efficiency
  const campaignsWithData = campaigns.filter((c: any) => c.spend > 0 && c.results > 0).sort((a: any, b: any) => a.cpr - b.cpr)
  const campaignCount = campaigns.filter((c: any) => c.spend > 0).length

  // Ad fatigue
  const adsWithSpend = ads.filter((a: any) => a.spend > 50)
  const fatiguedAds = adsWithSpend.filter((a: any) => a.spend > 100 && a.results === 0)
  const highCprAds = adsWithSpend.filter((a: any) => a.results > 0 && targetCpl && a.cpr > targetCpl * 2).sort((a: any, b: any) => b.spend - a.spend)
  const wastedSpend = fatiguedAds.reduce((s: number, a: any) => s + a.spend, 0) + highCprAds.reduce((s: number, a: any) => s + Math.max(0, a.spend - (targetCpl ? targetCpl * a.results : 0)), 0)

  // Creative mix
  const isVideoAd = (a: any) => a.creative_video_url || a.creative_url?.includes('/t15.5256-10/') || a.creative_url?.includes('/t15.13418-10/')
  const videoAds = ads.filter((a: any) => isVideoAd(a) && a.spend > 0)
  const imageAds = ads.filter((a: any) => !isVideoAd(a) && a.spend > 0)
  const videoResults = videoAds.reduce((s: number, a: any) => s + a.results, 0)
  const videoSpend = videoAds.reduce((s: number, a: any) => s + a.spend, 0)
  const imageResults = imageAds.reduce((s: number, a: any) => s + a.results, 0)
  const imageSpend = imageAds.reduce((s: number, a: any) => s + a.spend, 0)
  const videoCpr = videoResults > 0 ? videoSpend / videoResults : 0
  const imageCpr = imageResults > 0 ? imageSpend / imageResults : 0

  // Headline analysis
  const headlineMap = new Map<string, { spend: number; results: number; count: number }>()
  for (const a of ads.filter((a: any) => a.creative_headline && a.spend > 0)) {
    const h = a.creative_headline!
    const existing = headlineMap.get(h) || { spend: 0, results: 0, count: 0 }
    existing.spend += a.spend; existing.results += a.results; existing.count++
    headlineMap.set(h, existing)
  }
  const headlines = Array.from(headlineMap.entries())
    .map(([headline, data]) => ({ headline, ...data, cpr: data.results > 0 ? data.spend / data.results : Infinity }))
    .filter(h => h.results >= 2)
    .sort((a, b) => a.cpr - b.cpr)

  // Spend concentration
  const top3Ads = [...ads].filter((a: any) => a.spend > 0).sort((a: any, b: any) => b.spend - a.spend).slice(0, 3)
  const top3Spend = top3Ads.reduce((s: number, a: any) => s + a.spend, 0)
  const top3Pct = totalSpendAll > 0 ? (top3Spend / totalSpendAll) * 100 : 0

  // Zero-result days
  const zeroDays = daily.filter((d: any) => d.spend > 0 && d.results === 0)
  const overTargetDays = targetCpl ? daily.filter((d: any) => d.results > 0 && (d.spend / d.results) > targetCpl) : []

  const maxDowSpend = Math.max(...dowArray.map(d => d.avgSpend), 1)

  return (
    <div className="space-y-5">
      {/* Monthly Pacing */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold">Monthly Pacing</h3>
          <span className="text-[11px] text-[#9d9da8]">Day {pacingData.dayOfMonth} of {pacingData.daysInMonth}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div><p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Month Spend</p><p className="text-[18px] font-semibold tabular-nums mt-0.5">{formatCurrency(pacingData.monthSpend)}</p></div>
          <div><p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Projected Spend</p><p className="text-[18px] font-semibold tabular-nums mt-0.5">{formatCurrency(pacingData.projected)}</p></div>
          <div><p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Avg/Day</p><p className="text-[18px] font-semibold tabular-nums mt-0.5">{formatCurrency(pacingData.avgDaily)}</p></div>
          <div><p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Month {resultLabel}</p><p className="text-[18px] font-semibold tabular-nums mt-0.5">{formatNumber(pacingData.monthResults)}</p></div>
          <div><p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Proj. {resultLabel}</p><p className="text-[18px] font-semibold tabular-nums mt-0.5">{formatNumber(Math.round(pacingData.projectedResults))}</p></div>
        </div>
        <div className="mt-3 h-2 bg-[#f4f4f6] rounded-full overflow-hidden">
          <div className="h-full bg-[#2563eb] rounded-full transition-all" style={{ width: `${Math.min((pacingData.dayOfMonth / pacingData.daysInMonth) * 100, 100)}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-[#9d9da8]">
          <span>{((pacingData.dayOfMonth / pacingData.daysInMonth) * 100).toFixed(0)}% through month</span>
          <span>{pacingData.daysRemaining} days remaining</span>
        </div>
      </Card>

      {/* Scatter Plot */}
      {(() => {
        const scatterAds = ads.filter((a: any) => a.spend > 10 && a.results > 0).map((a: any) => ({ name: a.ad_name, spend: a.spend, cpr: a.cpr, results: a.results, campaign: a.campaign_name }))
        if (scatterAds.length < 3) return null
        const maxSpend = Math.max(...scatterAds.map((a: any) => a.spend))
        const maxCpr = Math.max(...scatterAds.map((a: any) => a.cpr))
        return (
          <Card className="p-5">
            <h3 className="text-[13px] font-semibold mb-1">Ad Efficiency Map</h3>
            <p className="text-[11px] text-[#9d9da8] mb-4">Each dot is an ad. Bottom-right = high spend, low CPR (ideal).</p>
            <div className="relative" style={{ height: 300 }}>
              <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-[9px] text-[#9d9da8] tabular-nums">
                <span>{formatCurrency(maxCpr)}</span><span>{formatCurrency(maxCpr / 2)}</span><span>$0</span>
              </div>
              <div className="absolute left-10 right-0 bottom-0 h-4 flex justify-between text-[9px] text-[#9d9da8] tabular-nums">
                <span>$0</span><span>{formatCurrency(maxSpend / 2)}</span><span>{formatCurrency(maxSpend)}</span>
              </div>
              <div className="absolute left-10 right-0 top-0 bottom-8 border-l border-b border-[#e8e8ec]">
                <div className="absolute inset-0 border-t border-r border-[#f4f4f6]" />
                {targetCpl && targetCpl < maxCpr && (
                  <div className="absolute left-0 right-0 border-t border-dashed border-[#dc2626]/30" style={{ top: `${(1 - targetCpl / maxCpr) * 100}%` }}>
                    <span className="absolute right-0 -top-3 text-[9px] text-[#dc2626]">Target {formatCurrency(targetCpl)}</span>
                  </div>
                )}
                {scatterAds.map((a: any, i: number) => {
                  const x = (a.spend / maxSpend) * 100
                  const y = (1 - a.cpr / maxCpr) * 100
                  const isOver = targetCpl ? a.cpr > targetCpl : false
                  const size = Math.max(6, Math.min(16, (a.results / Math.max(...scatterAds.map((s: any) => s.results))) * 16))
                  return (
                    <div key={i} className="absolute group" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
                      <div className={`rounded-full ${isOver ? 'bg-[#dc2626]' : 'bg-[#2563eb]'} opacity-70 hover:opacity-100 transition-opacity cursor-default`} style={{ width: size, height: size }} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                        <div className="bg-[#111113] text-white rounded px-2.5 py-1.5 text-[10px] whitespace-nowrap shadow-lg">
                          <p className="font-medium mb-0.5 max-w-[200px] truncate">{a.name}</p>
                          <p className="text-[#9d9da8]">{a.campaign?.slice(0, 30)}</p>
                          <p>Spend: {formatCurrency(a.spend)} · {a.results} {resultLabel.toLowerCase()}</p>
                          <p className={isOver ? 'text-[#fca5a5]' : 'text-[#86efac]'}>CPR: {formatCurrency(a.cpr)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4 text-[10px] text-[#9d9da8]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2563eb]" /> On/under target</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#dc2626]" /> Over target</span>
              <span>Dot size = result volume</span>
            </div>
          </Card>
        )
      })()}

      {/* Period Comparison */}
      {daily.length >= 14 && (() => {
        const halfLen = Math.floor(daily.length / 2)
        const p1 = daily.slice(0, halfLen); const p2 = daily.slice(halfLen)
        const p1Start = new Date(p1[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const p1End = new Date(p1[p1.length - 1].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const p2Start = new Date(p2[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const p2End = new Date(p2[p2.length - 1].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const metrics = [
          { label: 'Spend', p1: p1.reduce((s: number, d: any) => s + d.spend, 0), p2: p2.reduce((s: number, d: any) => s + d.spend, 0), fmt: formatCurrency, invert: false },
          { label: resultLabel, p1: p1.reduce((s: number, d: any) => s + d.results, 0), p2: p2.reduce((s: number, d: any) => s + d.results, 0), fmt: formatNumber, invert: false },
          { label: 'CPR', p1: p1.reduce((s: number, d: any) => s + d.results, 0) > 0 ? p1.reduce((s: number, d: any) => s + d.spend, 0) / p1.reduce((s: number, d: any) => s + d.results, 0) : 0, p2: p2.reduce((s: number, d: any) => s + d.results, 0) > 0 ? p2.reduce((s: number, d: any) => s + d.spend, 0) / p2.reduce((s: number, d: any) => s + d.results, 0) : 0, fmt: formatCurrency, invert: true },
          { label: 'Impressions', p1: p1.reduce((s: number, d: any) => s + d.impressions, 0), p2: p2.reduce((s: number, d: any) => s + d.impressions, 0), fmt: formatNumber, invert: false },
          { label: 'Clicks', p1: p1.reduce((s: number, d: any) => s + d.clicks, 0), p2: p2.reduce((s: number, d: any) => s + d.clicks, 0), fmt: formatNumber, invert: false },
          { label: 'CTR', p1: p1.reduce((s: number, d: any) => s + d.impressions, 0) > 0 ? (p1.reduce((s: number, d: any) => s + d.clicks, 0) / p1.reduce((s: number, d: any) => s + d.impressions, 0)) * 100 : 0, p2: p2.reduce((s: number, d: any) => s + d.impressions, 0) > 0 ? (p2.reduce((s: number, d: any) => s + d.clicks, 0) / p2.reduce((s: number, d: any) => s + d.impressions, 0)) * 100 : 0, fmt: formatPercent, invert: false },
        ]
        return (
          <Card className="p-5">
            <h3 className="text-[13px] font-semibold mb-4">Period Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="border-b border-[#e8e8ec]">
                  <th className="py-2 px-3 text-left text-[10px] text-[#9d9da8] uppercase tracking-wider">Metric</th>
                  <th className="py-2 px-3 text-right text-[10px] text-[#9d9da8] uppercase tracking-wider">{p1Start} – {p1End}</th>
                  <th className="py-2 px-3 text-right text-[10px] text-[#9d9da8] uppercase tracking-wider">{p2Start} – {p2End}</th>
                  <th className="py-2 px-3 text-right text-[10px] text-[#9d9da8] uppercase tracking-wider">Change</th>
                </tr></thead>
                <tbody>{metrics.map(m => {
                  const change = m.p1 > 0 ? ((m.p2 - m.p1) / m.p1) * 100 : 0
                  const isGood = m.invert ? change < 0 : change > 0
                  return (
                    <tr key={m.label} className="border-b border-[#f4f4f6]">
                      <td className="py-2.5 px-3 font-medium">{m.label}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#9d9da8]">{m.fmt(m.p1)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium">{m.fmt(m.p2)}</td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${Math.abs(change) < 1 ? 'text-[#9d9da8]' : isGood ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                        {Math.abs(change) < 1 ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          </Card>
        )
      })()}

      {/* Funnel Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'CPM', value: formatCurrency(cpm) },
          { label: 'CPC', value: formatCurrency(costPerClick) },
          { label: 'CTR', value: formatPercent(overallCtr) },
          { label: 'Conv Rate', value: formatPercent(convRate) },
          { label: 'LPV Rate', value: lpvTotal > 0 ? formatPercent(lpvRate) : '—' },
          { label: `Cost / ${resultLabel.replace(/s$/, '')}`, value: overallCpr > 0 ? formatCurrency(overallCpr) : '—', highlight: targetCpl && overallCpr > targetCpl ? 'text-[#dc2626]' : overallCpr > 0 ? 'text-[#16a34a]' : '' },
        ].map(m => (
          <Card key={m.label} className="p-4">
            <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">{m.label}</p>
            <p className={`text-[18px] font-semibold tabular-nums mt-1 ${'highlight' in m ? m.highlight : ''}`}>{m.value}</p>
          </Card>
        ))}
      </div>

      {/* Day of Week + Weekly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-4">Day-of-Week Performance</h3>
          <div className="space-y-2">
            {dowArray.map(d => (
              <div key={d.name} className={`flex items-center gap-3 py-1.5 ${bestDow?.fullName === d.fullName ? 'bg-[#f0fdf4] -mx-2 px-2 rounded' : worstDow?.fullName === d.fullName ? 'bg-[#fef2f2] -mx-2 px-2 rounded' : ''}`}>
                <span className="text-[11px] font-medium w-8 text-[#6b6b76]">{d.name}</span>
                <div className="flex-1 h-4 bg-[#f4f4f6] rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(d.avgSpend / maxDowSpend) * 100}%`, backgroundColor: d.cpr > 0 && targetCpl && d.cpr > targetCpl ? '#dc2626' : '#2563eb' }} />
                </div>
                <span className="text-[11px] tabular-nums w-14 text-right">{formatCurrency(d.avgSpend)}</span>
                <span className="text-[11px] tabular-nums w-10 text-right text-[#9d9da8]">{d.avgResults.toFixed(1)}</span>
                <span className={`text-[11px] tabular-nums w-12 text-right font-medium ${d.cpr > 0 && targetCpl && d.cpr > targetCpl ? 'text-[#dc2626]' : d.cpr > 0 ? 'text-[#16a34a]' : 'text-[#c4c4cc]'}`}>{d.cpr > 0 ? formatCurrency(d.cpr) : '—'}</span>
              </div>
            ))}
          </div>
          {bestDow && worstDow && bestDow.fullName !== worstDow.fullName && (
            <div className="mt-3 pt-3 border-t border-[#f4f4f6] text-[11px] space-y-1">
              <p><span className="text-[#16a34a] font-medium">Best: {bestDow.fullName}</span> — {formatCurrency(bestDow.cpr)} CPR avg</p>
              <p><span className="text-[#dc2626] font-medium">Worst: {worstDow.fullName}</span> — {formatCurrency(worstDow.cpr)} CPR avg</p>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-4">Weekly Trend</h3>
          {weeklyData.length > 1 ? (
            <div className="space-y-3">
              {weeklyData.map((w, i) => {
                const prev = i > 0 ? weeklyData[i - 1] : null
                const cprChange = prev && prev.cpr > 0 && w.cpr > 0 ? ((w.cpr - prev.cpr) / prev.cpr) * 100 : null
                return (
                  <div key={w.week} className="flex items-center gap-4 py-2 border-b border-[#f4f4f6] last:border-0">
                    <span className="text-[12px] font-medium w-8">{w.week}</span>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[12px]">
                      <div><span className="text-[#9d9da8] text-[10px]">Spend</span><p className="font-semibold tabular-nums">{formatCurrency(w.spend)}</p></div>
                      <div><span className="text-[#9d9da8] text-[10px]">{resultLabel}</span><p className="font-semibold tabular-nums">{w.results}</p></div>
                      <div><span className="text-[#9d9da8] text-[10px]">CPR</span><p className="font-semibold tabular-nums">{w.cpr > 0 ? formatCurrency(w.cpr) : '—'}{cprChange !== null && <span className={`ml-1 text-[10px] ${cprChange > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{cprChange > 0 ? '+' : ''}{cprChange.toFixed(0)}%</span>}</p></div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <p className="text-[12px] text-[#9d9da8]">Need 2+ weeks of data</p>}
        </Card>
      </div>

      {/* Spend Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Spend Concentration</h3>
          <div className="space-y-3 text-[12px]">
            <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Active ads</span><span className="font-medium">{ads.filter((a: any) => a.effective_status === 'ACTIVE').length} of {ads.length}</span></div>
            <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Top 3 ads % of spend</span><span className="font-medium">{top3Pct.toFixed(1)}%</span></div>
            <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Active campaigns</span><span className="font-medium">{campaignCount}</span></div>
            <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Ads with $0 results</span><span className={`font-medium ${fatiguedAds.length > 0 ? 'text-[#dc2626]' : ''}`}>{fatiguedAds.length}</span></div>
            <div className="flex justify-between py-2"><span className="text-[#9d9da8]">Est. wasted spend</span><span className={`font-semibold ${wastedSpend > 0 ? 'text-[#dc2626]' : ''}`}>{formatCurrency(wastedSpend)}</span></div>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Consistency</h3>
          <div className="space-y-3 text-[12px]">
            <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Days analyzed</span><span className="font-medium">{daily.length}</span></div>
            <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Days with results</span><span className="font-medium">{daysWithResults.length} ({daily.length > 0 ? ((daysWithResults.length / daily.length) * 100).toFixed(0) : 0}%)</span></div>
            <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Zero-result days</span><span className={`font-medium ${zeroDays.length > 3 ? 'text-[#dc2626]' : ''}`}>{zeroDays.length}</span></div>
            {targetCpl && (<>
              <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Days over target</span><span className={`font-medium ${overTargetDays.length > daily.length * 0.5 ? 'text-[#dc2626]' : ''}`}>{overTargetDays.length} ({daily.length > 0 ? ((overTargetDays.length / Math.max(daysWithResults.length, 1)) * 100).toFixed(0) : 0}%)</span></div>
              <div className="flex justify-between py-2"><span className="text-[#9d9da8]">On-target rate</span><span className={`font-semibold ${(daysWithResults.length - overTargetDays.length) / Math.max(daysWithResults.length, 1) > 0.6 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{daysWithResults.length > 0 ? (((daysWithResults.length - overTargetDays.length) / daysWithResults.length) * 100).toFixed(0) : 0}%</span></div>
            </>)}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Creative Mix</h3>
          <div className="space-y-3 text-[12px]">
            <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Image ads</span><span className="font-medium">{imageAds.length} ({imageSpend > 0 ? formatCurrency(imageCpr) + ' CPR' : 'no spend'})</span></div>
            <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Video ads</span><span className="font-medium">{videoAds.length} ({videoSpend > 0 ? formatCurrency(videoCpr) + ' CPR' : 'no spend'})</span></div>
            <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Better format</span><span className={`font-semibold ${videoCpr > 0 && imageCpr > 0 ? (videoCpr < imageCpr ? 'text-[#8b5cf6]' : 'text-[#2563eb]') : ''}`}>{videoCpr > 0 && imageCpr > 0 ? (videoCpr < imageCpr ? 'Video' : 'Image') : '—'}{videoCpr > 0 && imageCpr > 0 && <span className="text-[#9d9da8] font-normal ml-1">by {Math.abs(((Math.min(videoCpr, imageCpr) / Math.max(videoCpr, imageCpr)) - 1) * 100).toFixed(0)}%</span>}</span></div>
            <div className="flex justify-between py-2 border-b border-[#f4f4f6]"><span className="text-[#9d9da8]">Unique headlines</span><span className="font-medium">{headlineMap.size}</span></div>
            <div className="flex justify-between py-2"><span className="text-[#9d9da8]">Unique CTAs</span><span className="font-medium">{new Set(ads.filter((a: any) => a.creative_cta).map((a: any) => a.creative_cta)).size}</span></div>
          </div>
        </Card>
      </div>

      {/* Campaign Rankings + Wasted Spend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {campaignsWithData.length > 0 && (
          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec]"><h3 className="text-[13px] font-semibold">Campaign Efficiency Ranking</h3></div>
            <div className="divide-y divide-[#f4f4f6]">
              {campaignsWithData.slice(0, 8).map((c: any, i: number) => (
                <div key={c.platform_campaign_id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${i < 3 ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#f4f4f6] text-[#9d9da8]'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-[12px] font-medium truncate">{c.campaign_name}</p><p className="text-[10px] text-[#9d9da8]">{c.results} {resultLabel.toLowerCase()} · {formatCurrency(c.spend)} spent</p></div>
                  <span className={`text-[12px] font-semibold tabular-nums ${targetCpl && c.cpr > targetCpl ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(c.cpr)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {(fatiguedAds.length > 0 || highCprAds.length > 0) && (
          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec] flex items-center justify-between"><h3 className="text-[13px] font-semibold">Wasted Spend Detection</h3><span className="text-[11px] text-[#dc2626] font-medium">{formatCurrency(wastedSpend)} potential waste</span></div>
            <div className="divide-y divide-[#f4f4f6]">
              {fatiguedAds.slice(0, 5).map((a: any) => (
                <div key={a.platform_ad_id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 h-5 rounded bg-[#fef2f2] text-[#dc2626] text-[10px] font-bold flex items-center justify-center flex-shrink-0">!</span>
                  <div className="flex-1 min-w-0"><p className="text-[12px] font-medium truncate">{a.ad_name}</p><p className="text-[10px] text-[#dc2626]">Spent {formatCurrency(a.spend)} with 0 results</p></div>
                  <span className="text-[12px] font-semibold tabular-nums text-[#dc2626]">{formatCurrency(a.spend)}</span>
                </div>
              ))}
              {highCprAds.slice(0, 5).map((a: any) => (
                <div key={a.platform_ad_id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 h-5 rounded bg-[#fff7ed] text-[#ea580c] text-[10px] font-bold flex items-center justify-center flex-shrink-0">!</span>
                  <div className="flex-1 min-w-0"><p className="text-[12px] font-medium truncate">{a.ad_name}</p><p className="text-[10px] text-[#ea580c]">CPR {formatCurrency(a.cpr)} — {targetCpl ? `${((a.cpr / targetCpl - 1) * 100).toFixed(0)}% over target` : 'very high'}</p></div>
                  <span className="text-[12px] font-semibold tabular-nums text-[#ea580c]">{formatCurrency(a.spend)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Headline Performance */}
      {headlines.length >= 2 && (
        <Card>
          <div className="px-5 py-4 border-b border-[#e8e8ec]"><h3 className="text-[13px] font-semibold">Headline Performance</h3></div>
          <div className="divide-y divide-[#f4f4f6]">
            {headlines.slice(0, 8).map((h, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${i < 3 ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#f4f4f6] text-[#9d9da8]'}`}>{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-[12px] font-medium truncate">&ldquo;{h.headline}&rdquo;</p><p className="text-[10px] text-[#9d9da8]">{h.count} ad{h.count > 1 ? 's' : ''} · {h.results} {resultLabel.toLowerCase()}</p></div>
                <span className={`text-[12px] font-semibold tabular-nums ${targetCpl && h.cpr > targetCpl ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(h.cpr)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* CTA Performance */}
      {(() => {
        const ctaMapLocal = new Map<string, { spend: number; results: number; count: number }>()
        for (const a of ads.filter((a: any) => a.creative_cta && a.spend > 0)) {
          const c = a.creative_cta!
          const existing = ctaMapLocal.get(c) || { spend: 0, results: 0, count: 0 }
          existing.spend += a.spend; existing.results += a.results; existing.count++
          ctaMapLocal.set(c, existing)
        }
        const ctas = Array.from(ctaMapLocal.entries()).map(([cta, data]) => ({ cta, ...data, cpr: data.results > 0 ? data.spend / data.results : Infinity })).filter(c => c.results >= 1).sort((a, b) => a.cpr - b.cpr)
        if (ctas.length < 2) return null
        return (
          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec]"><h3 className="text-[13px] font-semibold">CTA Performance</h3></div>
            <div className="divide-y divide-[#f4f4f6]">
              {ctas.map((c, i) => (
                <div key={c.cta} className="flex items-center gap-3 px-5 py-3">
                  <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${i === 0 ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#f4f4f6] text-[#9d9da8]'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-[12px] font-medium">{c.cta.replace(/_/g, ' ')}</p><p className="text-[10px] text-[#9d9da8]">{c.count} ad{c.count > 1 ? 's' : ''} · {c.results} {resultLabel.toLowerCase()} · {formatCurrency(c.spend)} spent</p></div>
                  <span className={`text-[12px] font-semibold tabular-nums ${targetCpl && c.cpr > targetCpl ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{c.cpr < Infinity ? formatCurrency(c.cpr) : '—'}</span>
                </div>
              ))}
            </div>
          </Card>
        )
      })()}

      {/* Spend Distribution */}
      {campaigns.filter((c: any) => c.spend > 0).length > 1 && (
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-4">Spend Distribution</h3>
          <div className="flex h-6 rounded overflow-hidden mb-4">
            {campaigns.filter((c: any) => c.spend > 0).sort((a: any, b: any) => b.spend - a.spend).map((c: any, i: number) => {
              const colors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4', '#ec4899', '#6b7280']
              return (
                <div key={c.platform_campaign_id} className="h-full relative group" style={{ width: `${(c.spend / totalSpendAll) * 100}%`, backgroundColor: colors[i % colors.length] }} title={`${c.campaign_name}: ${formatCurrency(c.spend)}`}>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                    <div className="bg-[#111113] text-white rounded px-2.5 py-1.5 text-[10px] whitespace-nowrap shadow-lg">
                      <p className="font-medium">{c.campaign_name}</p>
                      <p className="text-[#9d9da8]">{formatCurrency(c.spend)} · {((c.spend / totalSpendAll) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
            {campaigns.filter((c: any) => c.spend > 0).sort((a: any, b: any) => b.spend - a.spend).slice(0, 6).map((c: any, i: number) => {
              const colors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4']
              return (
                <div key={c.platform_campaign_id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-[1px] flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                  <span className="truncate text-[#6b6b76]">{c.campaign_name}</span>
                  <span className="tabular-nums text-[#9d9da8] ml-auto flex-shrink-0">{((c.spend / totalSpendAll) * 100).toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
