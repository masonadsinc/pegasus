'use client'

import { useState, useEffect, useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency, formatNumber, formatPercent, formatCompact, wowChange, wowChangeCPL } from '@/lib/utils'
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
  clientName?: string
  accountName?: string
  platformAccountId?: string
  objective?: string
  primaryActionType?: string | null
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

/* Grade Badge removed */

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

/* ── Ad Image ───────────────────────────────────── */
function AdImage({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const [error, setError] = useState(false)
  if (!src || error) {
    return (
      <div className={`bg-[#f4f4f6] flex items-center justify-center text-[#c4c4cc] ${className}`}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    )
  }
  return <img src={src} alt={alt} className={`object-cover ${className}`} onError={() => setError(true)} loading="lazy" />
}

/* ── Ad Detail Modal ────────────────────────────── */
function AdDetailModal({ ad, open, onClose, resultLabel, targetCpl }: {
  ad: any; open: boolean; onClose: () => void; resultLabel: string; targetCpl: number | null
}) {
  const [fbUrl, setFbUrl] = useState<string | null>(null)
  const [fbLoading, setFbLoading] = useState(false)

  useEffect(() => {
    if (!ad?.platform_ad_id || !open) { setFbUrl(null); return }
    setFbLoading(true)
    fetch(`/api/facebook-url?ad_id=${ad.platform_ad_id}`)
      .then(r => r.json())
      .then(d => setFbUrl(d.url || null))
      .catch(() => setFbUrl(`https://www.facebook.com/ads/library/?id=${ad.platform_ad_id}`))
      .finally(() => setFbLoading(false))
  }, [ad?.platform_ad_id, open])

  if (!ad) return null
  const imageUrl = ad.creative_url || ad.creative_thumbnail_url
  const ctaMap: Record<string, string> = {
    LEARN_MORE: 'Learn More', SIGN_UP: 'Sign Up', SHOP_NOW: 'Shop Now', BOOK_TRAVEL: 'Book Now',
    CONTACT_US: 'Contact Us', DOWNLOAD: 'Download', GET_OFFER: 'Get Offer', GET_QUOTE: 'Get Quote',
    SUBSCRIBE: 'Subscribe', WATCH_MORE: 'Watch More', APPLY_NOW: 'Apply Now', ORDER_NOW: 'Order Now',
    CALL_NOW: 'Call Now', SEND_MESSAGE: 'Send Message', WHATSAPP_MESSAGE: 'WhatsApp',
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <div className="flex flex-col md:flex-row min-h-[400px]">
          {/* Left: Creative */}
          <div className="md:w-[45%] flex-shrink-0 bg-[#f4f4f6] flex items-center justify-center rounded-t-2xl md:rounded-t-none md:rounded-l-2xl overflow-hidden">
            {ad.creative_video_url ? (
              <video src={ad.creative_video_url} controls className="w-full h-full object-contain" />
            ) : imageUrl ? (
              <img src={imageUrl} alt={ad.ad_name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} loading="lazy" />
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c4c4cc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
              </svg>
            )}
          </div>

          {/* Right: Details */}
          <div className="md:w-[55%] p-5 space-y-4 overflow-y-auto max-h-[80vh]">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <DialogTitle>{ad.ad_name}</DialogTitle>
                {ad.effective_status && (
                  <Badge variant={ad.effective_status === 'ACTIVE' ? 'success' : 'danger'}>
                    {ad.effective_status.toLowerCase().replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
              <DialogDescription>{ad.campaign_name}</DialogDescription>
            </div>

            {/* View on Facebook */}
            <a
              href={fbUrl || `https://www.facebook.com/ads/library/?id=${ad.platform_ad_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#1877f2] hover:bg-[#166fe5] text-white text-[12px] font-medium rounded-lg transition-colors w-fit"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              {fbLoading ? 'Loading...' : 'View on Facebook'}
            </a>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Spend', value: formatCurrency(ad.spend) },
                { label: resultLabel, value: formatNumber(ad.results) },
                { label: 'CPR', value: ad.cpr > 0 ? formatCurrency(ad.cpr) : '—', highlight: targetCpl && ad.cpr > targetCpl ? 'text-[#dc2626]' : ad.cpr > 0 ? 'text-[#16a34a]' : '' },
                { label: 'CTR', value: formatPercent(ad.ctr) },
                { label: 'Impressions', value: formatNumber(ad.impressions) },
                { label: 'Clicks', value: formatNumber(ad.clicks) },
              ].map(m => (
                <div key={m.label} className="bg-[#f8f8fa] rounded-lg p-2.5">
                  <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">{m.label}</p>
                  <p className={`text-[14px] font-bold tabular-nums ${m.highlight || ''}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Creative Copy */}
            {(ad.creative_headline || ad.creative_body || ad.creative_cta) && (
              <div className="border border-[#e8e8ec] rounded-xl p-4 space-y-2">
                <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider font-medium">Ad Copy</p>
                {ad.creative_headline && <p className="text-[14px] font-semibold text-[#111113]">{ad.creative_headline}</p>}
                {ad.creative_body && <p className="text-[13px] text-[#6b6b76] whitespace-pre-line leading-relaxed">{ad.creative_body}</p>}
                {ad.creative_cta && (
                  <span className="inline-block mt-1 px-3 py-1.5 bg-[#2563eb] text-white text-[11px] font-medium rounded-lg">
                    {ctaMap[ad.creative_cta] || ad.creative_cta.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const tooltipStyle = {
  contentStyle: { background: '#fff', border: '1px solid #e8e8ec', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
  labelStyle: { color: '#9d9da8' },
}

/* ── MAIN TABS ──────────────────────────────────── */
export function ClientTabs({ daily, campaigns, ads, topAds, bottomAds, funnelSteps, ageGender, placement, device, region, resultLabel, isEcom, targetCpl, targetRoas, totalSpend, clientName, accountName, platformAccountId, objective, primaryActionType }: ClientTabsProps) {
  const chartData = daily.map(d => ({
    date: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    spend: Math.round(d.spend * 100) / 100,
    results: d.results,
    cpr: d.results > 0 ? Math.round((d.spend / d.results) * 100) / 100 : 0,
    impressions: d.impressions,
    clicks: d.clicks,
  }))

  const [chartMetrics, setChartMetrics] = useState<Set<string>>(new Set(['spend', 'results']))
  const [selectedAd, setSelectedAd] = useState<any>(null)
  const [adsView, setAdsView] = useState<'grid' | 'table'>('grid')
  const [adSearch, setAdSearch] = useState('')
  const [adSort, setAdSort] = useState<'spend' | 'cpr' | 'results' | 'ctr'>('spend')
  const [adStatusFilter, setAdStatusFilter] = useState<'all' | 'active' | 'paused'>('all')

  const filteredAds = useMemo(() => {
    let list = [...ads]
    if (adSearch) {
      const q = adSearch.toLowerCase()
      list = list.filter(a => a.ad_name.toLowerCase().includes(q) || a.campaign_name.toLowerCase().includes(q) || (a.creative_body && a.creative_body.toLowerCase().includes(q)))
    }
    if (adStatusFilter === 'active') list = list.filter(a => a.effective_status === 'ACTIVE')
    if (adStatusFilter === 'paused') list = list.filter(a => a.effective_status !== 'ACTIVE')
    list.sort((a, b) => {
      if (adSort === 'cpr') return (a.cpr || Infinity) - (b.cpr || Infinity)
      if (adSort === 'results') return b.results - a.results
      if (adSort === 'ctr') return b.ctr - a.ctr
      return b.spend - a.spend
    })
    return list
  }, [ads, adSearch, adSort, adStatusFilter])

  const toggleMetric = (m: string) => {
    setChartMetrics(prev => {
      const next = new Set(prev)
      if (next.has(m)) { if (next.size > 1) next.delete(m) } else next.add(m)
      return next
    })
  }

  const metricButtons = [
    { key: 'spend', label: 'Spend', color: '#2563eb' },
    { key: 'results', label: resultLabel, color: '#16a34a' },
    { key: 'cpr', label: 'CPR', color: '#f59e0b' },
    { key: 'impressions', label: 'Impressions', color: '#8b5cf6' },
    { key: 'clicks', label: 'Clicks', color: '#06b6d4' },
    { key: 'ctr', label: 'CTR', color: '#ec4899' },
  ]

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
    <>
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="ads">Ads ({ads.length})</TabsTrigger>
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="daily">Daily</TabsTrigger>
        {ageGender.length > 0 && <TabsTrigger value="audience">Audience</TabsTrigger>}
        {placement.length > 0 && <TabsTrigger value="placements">Placements</TabsTrigger>}
        {region.length > 0 && <TabsTrigger value="geographic">Geographic</TabsTrigger>}
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      {/* ═══════════════════ OVERVIEW ═══════════════════ */}
      <TabsContent value="overview">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold">Performance Trend</h3>
              <div className="flex items-center gap-1">
                {metricButtons.map(m => (
                  <button key={m.key} onClick={() => toggleMetric(m.key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      chartMetrics.has(m.key) ? 'text-white' : 'text-[#9d9da8] bg-[#f4f4f6] hover:bg-[#e8e8ec]'
                    }`}
                    style={chartMetrics.has(m.key) ? { backgroundColor: m.color } : undefined}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData.map(d => ({
                ...d,
                ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
              }))}>
                <defs>
                  {metricButtons.map(m => (
                    <linearGradient key={m.key} id={`grad_${m.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={m.color} stopOpacity={0.12} />
                      <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f2" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9d9da8' }} axisLine={{ stroke: '#e8e8ec' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9d9da8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9d9da8' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                {chartMetrics.has('spend') && <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#2563eb" fill="url(#grad_spend)" name="Spend ($)" strokeWidth={2} />}
                {chartMetrics.has('results') && <Area yAxisId="right" type="monotone" dataKey="results" stroke="#16a34a" fill="url(#grad_results)" name={resultLabel} strokeWidth={2} />}
                {chartMetrics.has('cpr') && <Area yAxisId="left" type="monotone" dataKey="cpr" stroke="#f59e0b" fill="url(#grad_cpr)" name="CPR ($)" strokeWidth={2} />}
                {chartMetrics.has('impressions') && <Area yAxisId="right" type="monotone" dataKey="impressions" stroke="#8b5cf6" fill="url(#grad_impressions)" name="Impressions" strokeWidth={2} />}
                {chartMetrics.has('clicks') && <Area yAxisId="right" type="monotone" dataKey="clicks" stroke="#06b6d4" fill="url(#grad_clicks)" name="Clicks" strokeWidth={2} />}
                {chartMetrics.has('ctr') && <Area yAxisId="right" type="monotone" dataKey="ctr" stroke="#ec4899" fill="url(#grad_ctr)" name="CTR (%)" strokeWidth={2} />}
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
                    <div key={ad.platform_ad_id} className="flex items-center gap-3 cursor-pointer hover:bg-[#fafafb] rounded-lg p-1.5 -m-1.5 transition-colors" onClick={() => setSelectedAd(ad)}>
                      <AdImage src={ad.creative_url || ad.creative_thumbnail_url} alt={ad.ad_name} className="w-10 h-10 rounded-lg flex-shrink-0" />
                      <span className="w-5 h-5 rounded-full bg-[#dcfce7] text-[#16a34a] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
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
                    <div key={ad.platform_ad_id} className="flex items-center gap-3 cursor-pointer hover:bg-[#fafafb] rounded-lg p-1.5 -m-1.5 transition-colors" onClick={() => setSelectedAd(ad)}>
                      <AdImage src={ad.creative_url || ad.creative_thumbnail_url} alt={ad.ad_name} className="w-10 h-10 rounded-lg flex-shrink-0" />
                      <span className="w-5 h-5 rounded-full bg-[#fef2f2] text-[#dc2626] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
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
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9d9da8]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
                <input value={adSearch} onChange={e => setAdSearch(e.target.value)} placeholder="Search ads..." className="pl-8 pr-3 py-1.5 text-[12px] bg-white border border-[#e8e8ec] rounded-lg w-[200px] focus:outline-none focus:border-[#2563eb] placeholder-[#9d9da8]" />
              </div>
              <div className="flex items-center gap-1 bg-white border border-[#e8e8ec] rounded-lg p-0.5">
                {(['all', 'active', 'paused'] as const).map(f => (
                  <button key={f} onClick={() => setAdStatusFilter(f)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${adStatusFilter === f ? 'bg-[#111113] text-white' : 'text-[#9d9da8] hover:bg-[#f4f4f6]'}`}>
                    {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Paused'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-[#9d9da8]">Sort:</span>
                {(['spend', 'cpr', 'results', 'ctr'] as const).map(s => (
                  <button key={s} onClick={() => setAdSort(s)} className={`font-medium transition-colors ${adSort === s ? 'text-[#111113]' : 'text-[#c4c4cc] hover:text-[#6b6b76]'}`}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setAdsView('grid')} className={`p-1.5 rounded-md ${adsView === 'grid' ? 'bg-[#111113] text-white' : 'text-[#9d9da8] hover:bg-[#f4f4f6]'}`}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
                </button>
                <button onClick={() => setAdsView('table')} className={`p-1.5 rounded-md ${adsView === 'table' ? 'bg-[#111113] text-white' : 'text-[#9d9da8] hover:bg-[#f4f4f6]'}`}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="1" y="12" width="14" height="2" rx="0.5"/></svg>
                </button>
              </div>
            </div>
          </div>

          <p className="text-[12px] text-[#9d9da8]">{filteredAds.length} of {ads.length} ads</p>

          {adsView === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAds.map(ad => {
                const imageUrl = ad.creative_url || ad.creative_thumbnail_url
                return (
                  <Card key={ad.platform_ad_id} className="overflow-hidden cursor-pointer hover:shadow-md hover:border-[#c4c4cc] transition-all" onClick={() => setSelectedAd(ad)}>
                    <AdImage src={imageUrl} alt={ad.ad_name} className="w-full h-[180px]" />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[13px] font-medium truncate flex-1">{ad.ad_name}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <span className="text-[#9d9da8]">Spend</span>
                          <p className="font-semibold tabular-nums">{formatCurrency(ad.spend)}</p>
                        </div>
                        <div>
                          <span className="text-[#9d9da8]">{resultLabel}</span>
                          <p className="font-semibold tabular-nums">{ad.results}</p>
                        </div>
                        <div>
                          <span className="text-[#9d9da8]">CPR</span>
                          <p className={`font-semibold tabular-nums ${ad.cpr > 0 ? (targetCpl && ad.cpr > targetCpl ? 'text-[#dc2626]' : 'text-[#16a34a]') : 'text-[#c4c4cc]'}`}>
                            {ad.cpr > 0 ? formatCurrency(ad.cpr) : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <DataTable
                columns={[
                  { key: '_img', label: '', format: (_, row) => <AdImage src={row.creative_url || row.creative_thumbnail_url} alt={row.ad_name} className="w-10 h-10 rounded-md" /> },
                  { key: 'ad_name', label: 'Ad', format: (v, row) => <button className="font-medium text-left hover:text-[#2563eb] transition-colors" onClick={() => setSelectedAd(row)}>{v}</button> },
                  { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                  { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                  { key: 'cpr', label: 'CPR', format: (v: number) => {
                    if (v === 0) return <span className="text-[#c4c4cc]">—</span>
                    const isOver = targetCpl ? v > targetCpl : false
                    return <span className={`font-semibold ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(v)}</span>
                  }, align: 'right' },
                  { key: 'ctr', label: 'CTR', format: (v: number) => <span className="text-[#6b6b76]">{formatPercent(v)}</span>, align: 'right' },
                ]}
                data={filteredAds}
              />
            </Card>
          )}
        </div>

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
                  { key: '_pct', label: '% Total', format: (_, row) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
                ]}
                data={placement}
              />
            </Card>
          </div>
        </TabsContent>
      )}

      {/* ═══════════════════ GEOGRAPHIC ═══════════════════ */}
      {region.length > 0 && (() => {
        const geoTotal = { spend: 0, impressions: 0, clicks: 0 }
        region.forEach(r => { geoTotal.spend += r.spend; geoTotal.impressions += r.impressions; geoTotal.clicks += r.clicks })
        const maxR = region[0]?.spend || 1

        // US region mapping
        const regionMap: Record<string, string[]> = {
          'Northeast': ['Connecticut','Maine','Massachusetts','New Hampshire','New Jersey','New York','Pennsylvania','Rhode Island','Vermont'],
          'Southeast': ['Alabama','Arkansas','Delaware','Florida','Georgia','Kentucky','Louisiana','Maryland','Mississippi','North Carolina','South Carolina','Tennessee','Virginia','West Virginia','District of Columbia'],
          'Midwest': ['Illinois','Indiana','Iowa','Kansas','Michigan','Minnesota','Missouri','Nebraska','North Dakota','Ohio','South Dakota','Wisconsin'],
          'Southwest': ['Arizona','New Mexico','Oklahoma','Texas'],
          'West': ['Alaska','California','Colorado','Hawaii','Idaho','Montana','Nevada','Oregon','Utah','Washington','Wyoming'],
        }
        const regionGroups: Record<string, { spend: number; ctr: number; count: number }> = {}
        for (const [rg, states] of Object.entries(regionMap)) {
          let spend = 0, impr = 0, clicks = 0, count = 0
          region.forEach(r => { if (states.some(s => r.dimension_value?.includes(s))) { spend += r.spend; impr += r.impressions; clicks += r.clicks; count++ } })
          if (count) regionGroups[rg] = { spend, ctr: impr > 0 ? (clicks / impr) * 100 : 0, count }
        }

        return (
          <TabsContent value="geographic">
            <div className="space-y-5">
              {/* Overview row */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-5">
                  <h3 className="text-[14px] font-semibold mb-2">Geographic Overview</h3>
                  <p className="text-[11px] text-[#9d9da8] mb-3">{region.length} states active</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
                    <div><span className="text-[#9d9da8]">Total Spend</span><p className="font-bold text-[16px]">{formatCompact(geoTotal.spend)}</p></div>
                    <div><span className="text-[#9d9da8]">Impressions</span><p className="font-bold text-[16px]">{formatCompact(geoTotal.impressions)}</p></div>
                    <div><span className="text-[#9d9da8]">Clicks</span><p className="font-bold text-[16px]">{formatCompact(geoTotal.clicks)}</p></div>
                    <div><span className="text-[#9d9da8]">CTR</span><p className="font-bold text-[16px]">{geoTotal.impressions > 0 ? formatPercent((geoTotal.clicks / geoTotal.impressions) * 100) : '—'}</p></div>
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="text-[14px] font-semibold mb-3">Regional Performance</h3>
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
                  <h3 className="text-[14px] font-semibold mb-3">State Performance</h3>
                  <div className="grid grid-cols-5 gap-1.5">
                    {region.slice(0, 15).map(r => {
                      const abbr = r.dimension_value?.slice(0, 2).toUpperCase() || '??'
                      const pct = totalSpend > 0 ? ((r.spend / totalSpend) * 100).toFixed(1) : '0'
                      return (
                        <div key={r.dimension_value} className="text-center p-1.5 rounded-lg bg-[#f4f4f6]">
                          <p className="text-[11px] font-semibold text-[#2563eb]">{abbr}</p>
                          <p className="text-[9px] text-[#9d9da8]">{pct}%</p>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </div>

              {/* Top States bar chart */}
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold mb-3">Top States by Spend</h3>
                <div className="space-y-2">
                  {region.slice(0, 10).map(r => (
                    <div key={r.dimension_value} className="flex items-center gap-3">
                      <span className="text-[11px] font-medium w-6">{r.dimension_value?.slice(0, 2).toUpperCase()}</span>
                      <div className="flex-1 h-5 bg-[#f4f4f6] rounded overflow-hidden">
                        <div className="h-full bg-[#16a34a] rounded" style={{ width: `${(r.spend / maxR) * 100}%` }} />
                      </div>
                      <span className="text-[11px] tabular-nums w-16 text-right">{formatCurrency(r.spend)}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* All States table */}
              <Card>
                <div className="px-5 py-4 border-b border-[#e8e8ec]">
                  <h3 className="text-[14px] font-semibold">All States</h3>
                </div>
                <DataTable
                  columns={[
                    { key: 'dimension_value', label: 'State', format: (v) => <><span className="font-medium text-[11px] text-[#9d9da8] mr-2">{v?.slice(0, 2).toUpperCase()}</span><span className="font-medium">{v}</span></> },
                    { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                    { key: 'impressions', label: 'Impressions', format: (v) => formatNumber(v), align: 'right' },
                    { key: 'clicks', label: 'Clicks', format: (v) => formatNumber(v), align: 'right' },
                    { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
                    { key: '_pct', label: '% Total', format: (_, row) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
                  ]}
                  data={region}
                />
              </Card>
            </div>
          </TabsContent>
        )
      })()}
      {/* ═══════════════════ SETTINGS ═══════════════════ */}
      <TabsContent value="settings">
        <div className="space-y-5 max-w-2xl">
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-4">Account Configuration</h3>
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
                <span className="text-[#9d9da8]">Account Name</span>
                <span className="font-medium">{clientName || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
                <span className="text-[#9d9da8]">Platform Account ID</span>
                <span className="font-mono text-[12px]">{platformAccountId || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
                <span className="text-[#9d9da8]">Objective</span>
                <span className="font-medium capitalize">{objective || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
                <span className="text-[#9d9da8]">Primary Action Type</span>
                <span className="font-mono text-[12px]">{primaryActionType || 'lead'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
                <span className="text-[#9d9da8]">Result Label</span>
                <span className="font-medium">{resultLabel}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
                <span className="text-[#9d9da8]">{isEcom ? 'Target ROAS' : 'Target CPR'}</span>
                <span className="font-semibold">{isEcom ? (targetRoas ? `${targetRoas}x` : '—') : (targetCpl ? formatCurrency(targetCpl) : '—')}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#9d9da8]">Account Type</span>
                <Badge variant={isEcom ? 'info' : 'success'}>{isEcom ? 'E-commerce' : 'Lead Gen'}</Badge>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[14px] font-semibold mb-4">Data Summary</h3>
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
                <span className="text-[#9d9da8]">Data Range</span>
                <span className="font-medium">Last 30 days</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
                <span className="text-[#9d9da8]">Total Days with Data</span>
                <span className="font-medium">{daily.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
                <span className="text-[#9d9da8]">Active Campaigns</span>
                <span className="font-medium">{campaigns.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#f4f4f6]">
                <span className="text-[#9d9da8]">Active Ads</span>
                <span className="font-medium">{ads.length}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#9d9da8]">Breakdown Data</span>
                <span className="font-medium">{ageGender.length > 0 ? 'Available' : 'None'}</span>
              </div>
            </div>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
    <AdDetailModal ad={selectedAd} open={!!selectedAd} onClose={() => setSelectedAd(null)} resultLabel={resultLabel} targetCpl={targetCpl} />
    </>
  )
}
