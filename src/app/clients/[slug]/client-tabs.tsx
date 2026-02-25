'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { CreativeAnalysis } from './creative-analysis'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency, formatNumber, formatPercent, formatCompact, wowChange, wowChangeCPL } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts'

interface ClientTabsProps {
  clientId?: string
  initialPortalToken?: string | null
  portalMode?: boolean
  daily: any[]
  campaigns: any[]
  adSets: any[]
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
function Spark({ data, color = '#2563eb', h = 32, labels, formatVal }: { data: number[]; color?: string; h?: number; labels?: string[]; formatVal?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length < 2) return null
  const max = Math.max(...data, 1); const min = Math.min(...data, 0); const range = max - min || 1
  const w = 100
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: h - ((v - min) / range) * (h - 4) - 2 }))
  const areaPath = `M0,${h} ${pts.map(p => `L${p.x},${p.y}`).join(' ')} L${w},${h} Z`
  const polyPts = pts.map(p => `${p.x},${p.y}`).join(' ')
  return (
    <div className="relative mt-2 w-full" style={{ height: h }}
      onMouseMove={e => { const rect = e.currentTarget.getBoundingClientRect(); const pct = (e.clientX - rect.left) / rect.width; setHover(Math.min(data.length - 1, Math.max(0, Math.round(pct * (data.length - 1))))) }}
      onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
        <defs><linearGradient id={`sg_${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.15" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d={areaPath} fill={`url(#sg_${color.replace('#','')})`} />
        <polyline points={polyPts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hover !== null && pts[hover] && <circle cx={pts[hover].x} cy={pts[hover].y} r="3" fill={color} stroke="white" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover !== null && labels?.[hover] && (
        <div className="absolute bottom-full mb-1 -translate-x-1/2 z-50 pointer-events-none" style={{ left: `${(hover / (data.length - 1)) * 100}%` }}>
          <div className="bg-[#111113] text-white rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-lg text-center">
            <p className="text-[#9d9da8]">{labels[hover]}</p>
            <p className="font-semibold">{formatVal ? formatVal(data[hover]) : data[hover].toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Stat Box ───────────────────────────────────── */
function StatBox({ label, value, sub, change, sparkData, sparkColor, sparkLabels, sparkFormat, icon, highlight }: {
  label: string; value: string; sub?: string; change?: { label: string; positive: boolean }; sparkData?: number[]; sparkColor?: string; sparkLabels?: string[]; sparkFormat?: (v: number) => string; icon?: string; highlight?: boolean
}) {
  return (
    <Card className={`p-4 ${highlight ? 'border-[#f59e0b] border-2' : ''}`}>
      <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">{label}</p>
      <p className="text-[18px] font-semibold tabular-nums text-[#111113] mt-1">{value}</p>
      <div className="flex items-center gap-2 mt-0.5">
        {sub && <span className="text-[11px] text-[#9d9da8]">{sub}</span>}
        {change && change.label !== '—' && (
          <span className={`text-[11px] font-medium ${change.positive ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{change.label}</span>
        )}
      </div>
      {sparkData && <Spark data={sparkData} color={sparkColor || '#2563eb'} labels={sparkLabels} formatVal={sparkFormat} />}
    </Card>
  )
}

/* Grade Badge removed */

/* ── Data Table ─────────────────────────────────── */
function DataTable({ columns, data, pageSize = 50, emptyMessage = 'No data available' }: { columns: { key: string; label: string; format?: (v: any, row?: any) => string | React.ReactNode; align?: string }[]; data: any[]; pageSize?: number; emptyMessage?: string }) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(data.length / pageSize)
  const pageData = data.slice(page * pageSize, (page + 1) * pageSize)

  return (
    <div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#e8e8ec]">
              {columns.map(col => (
                <th key={col.key} className={`py-3 px-4 text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 && (
              <tr><td colSpan={columns.length} className="py-12 text-center text-[#9d9da8] text-[13px]">{emptyMessage}</td></tr>
            )}
            {pageData.map((row, i) => (
              <tr key={i} className={`border-b border-[#f4f4f6] hover:bg-[#f0f4ff] transition-colors ${row._highlight ? 'bg-[#fffbeb]' : i % 2 === 1 ? 'bg-[#fafafb]' : ''}`}>
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#e8e8ec]">
          <span className="text-[11px] text-[#9d9da8]">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} of {data.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-2.5 py-1 text-[11px] font-medium rounded-md disabled:opacity-30 text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors">← Prev</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i : page < 3 ? i : page > totalPages - 3 ? totalPages - 5 + i : page - 2 + i
              return (
                <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-[11px] font-medium rounded-md transition-colors ${page === p ? 'bg-[#111113] text-white' : 'text-[#6b6b76] hover:bg-[#f4f4f6]'}`}>{p + 1}</button>
              )
            })}
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} className="px-2.5 py-1 text-[11px] font-medium rounded-md disabled:opacity-30 text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors">Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Ad Image ───────────────────────────────────── */
function AdImage({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const [error, setError] = useState(false)
  if (!src || error) {
    return (
      <div className={`bg-gradient-to-br from-[#f4f4f6] to-[#e8e8ec] flex flex-col items-center justify-center text-[#c4c4cc] gap-1 ${className}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
        </svg>
        <span className="text-[9px] font-medium">No preview</span>
      </div>
    )
  }
  return <img src={src} alt={alt} className={`object-cover ${className}`} onError={() => setError(true)} loading="lazy" />
}

/* ── Ad Detail Modal ────────────────────────────── */
function AdDetailModal({ ad, open, onClose, resultLabel, targetCpl, onPrev, onNext }: {
  ad: any; open: boolean; onClose: () => void; resultLabel: string; targetCpl: number | null; onPrev?: () => void; onNext?: () => void
}) {
  const [fbUrl, setFbUrl] = useState<string | null>(null)
  const [fbLoading, setFbLoading] = useState(false)

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && onPrev) { e.preventDefault(); onPrev() }
      if (e.key === 'ArrowRight' && onNext) { e.preventDefault(); onNext() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onPrev, onNext])

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
          <div className="md:w-[45%] flex-shrink-0 bg-[#f4f4f6] flex items-center justify-center rounded-t-2xl md:rounded-t-none md:rounded-l-2xl overflow-hidden relative group/creative">
            {/* Prev/Next overlays */}
            {onPrev && <button onClick={(e) => { e.stopPropagation(); onPrev() }} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/creative:opacity-100 transition-opacity z-10"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4l-4 4 4 4" /></svg></button>}
            {onNext && <button onClick={(e) => { e.stopPropagation(); onNext() }} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/creative:opacity-100 transition-opacity z-10"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4" /></svg></button>}
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
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#1877f2] hover:bg-[#166fe5] text-white text-[12px] font-medium rounded transition-colors w-fit"
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
                <div key={m.label} className="bg-[#f8f8fa] rounded p-2.5">
                  <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">{m.label}</p>
                  <p className={`text-[13px] font-semibold tabular-nums ${m.highlight || ''}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Creative Copy */}
            {(ad.creative_headline || ad.creative_body || ad.creative_cta) && (
              <div className="border border-[#e8e8ec] rounded-md p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider font-medium">Ad Copy</p>
                  <button onClick={(e) => { e.stopPropagation(); const text = [ad.creative_headline, ad.creative_body].filter(Boolean).join('\n\n'); navigator.clipboard.writeText(text); const btn = e.currentTarget; btn.textContent = '✓ Copied'; setTimeout(() => { btn.textContent = 'Copy' }, 1500) }} className="text-[10px] text-[#2563eb] hover:text-[#1d4ed8] font-medium transition-colors">Copy</button>
                </div>
                {ad.creative_headline && <p className="text-[13px] font-semibold text-[#111113]">{ad.creative_headline}</p>}
                {ad.creative_body && <p className="text-[13px] text-[#6b6b76] whitespace-pre-line leading-relaxed">{ad.creative_body}</p>}
                {ad.creative_cta && (
                  <span className="inline-block mt-1 px-3 py-1.5 bg-[#2563eb] text-white text-[11px] font-medium rounded">
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
  contentStyle: { background: '#111113', border: 'none', borderRadius: '10px', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', color: '#fff', padding: '8px 12px' },
  labelStyle: { color: '#9d9da8', marginBottom: '4px' },
  itemStyle: { color: '#fff', padding: '1px 0' },
  cursor: { stroke: '#9d9da8', strokeDasharray: '3 3' },
}

/* ── MAIN TABS ──────────────────────────────────── */
export function ClientTabs({ clientId, initialPortalToken, portalMode = false, daily, campaigns, adSets, ads, topAds, bottomAds, funnelSteps, ageGender, placement, device, region, resultLabel, isEcom, targetCpl, targetRoas, totalSpend, clientName, accountName, platformAccountId, objective, primaryActionType }: ClientTabsProps) {
  const chartData = daily.map((d, i) => {
    // 7-day moving average
    const maWindow = daily.slice(Math.max(0, i - 6), i + 1)
    const maSpend = maWindow.reduce((s, p) => s + p.spend, 0) / maWindow.length
    const maResults = maWindow.reduce((s, p) => s + p.results, 0) / maWindow.length
    const maCpr = maWindow.reduce((s, p) => s + p.results, 0) > 0 ? maWindow.reduce((s, p) => s + p.spend, 0) / maWindow.reduce((s, p) => s + p.results, 0) : 0
    return {
      date: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      spend: Math.round(d.spend * 100) / 100,
      results: d.results,
      cpr: d.results > 0 ? Math.round((d.spend / d.results) * 100) / 100 : 0,
      impressions: d.impressions,
      clicks: d.clicks,
      ma_spend: Math.round(maSpend * 100) / 100,
      ma_results: Math.round(maResults * 100) / 100,
      ma_cpr: Math.round(maCpr * 100) / 100,
    }
  })

  const [chartMetrics, setChartMetrics] = useState<Set<string>>(new Set(['spend', 'results']))
  const [selectedAd, setSelectedAd] = useState<any>(null)
  const [adsView, setAdsView] = useState<'grid' | 'table'>('table')
  const [adSearch, setAdSearch] = useState('')
  const [adSort, setAdSort] = useState<'spend' | 'cpr' | 'results' | 'ctr'>('spend')
  const [adStatusFilter, setAdStatusFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [portalToken, setPortalToken] = useState<string | null>(initialPortalToken || null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [drillLevel, setDrillLevel] = useState<'campaigns' | 'adsets' | 'ads'>('campaigns')
  const [drillCampaignId, setDrillCampaignId] = useState<string | null>(null)
  const [drillAdSetId, setDrillAdSetId] = useState<string | null>(null)

  // Notes/Annotations (localStorage-based)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  useEffect(() => {
    try { const stored = localStorage.getItem(`notes_${platformAccountId}`); if (stored) setNotes(JSON.parse(stored)) } catch {}
  }, [platformAccountId])
  const saveNote = (date: string, text: string) => {
    const updated = { ...notes, [date]: text }
    if (!text.trim()) delete updated[date]
    setNotes(updated)
    localStorage.setItem(`notes_${platformAccountId}`, JSON.stringify(updated))
    setEditingNote(null)
  }

  const filteredAds = useMemo(() => {
    let list = [...ads]
    if (campaignFilter) list = list.filter(a => a.platform_campaign_id === campaignFilter)
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
  }, [ads, adSearch, adSort, adStatusFilter, campaignFilter])

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

  // Current period = full daily range; prior period = same length before that
  const periodLen = daily.length
  const tw = daily // current period is the full selected range
  const lw = daily.slice(0, Math.floor(periodLen / 2)) // first half for comparison
  const twHalf = daily.slice(Math.floor(periodLen / 2)) // second half
  const twSum = (key: string) => tw.reduce((s, d) => s + (d[key] || 0), 0)
  const lwSum = (key: string) => lw.reduce((s, d) => s + (d[key] || 0), 0)
  // For WoW: use second half vs first half
  const tw2Sum = (key: string) => twHalf.reduce((s, d) => s + (d[key] || 0), 0)
  const lw2Sum = (key: string) => lw.reduce((s, d) => s + (d[key] || 0), 0)
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

  // Anomaly detection: flag days with significant deviations
  const anomalies = useMemo(() => {
    const flags: Record<string, string[]> = {}
    if (daily.length < 7) return flags
    for (let i = 7; i < daily.length; i++) {
      const d = daily[i]
      const prev7 = daily.slice(i - 7, i)
      const avgSpend = prev7.reduce((s, p) => s + p.spend, 0) / 7
      const avgResults = prev7.reduce((s, p) => s + p.results, 0) / 7
      const avgCpr = prev7.filter(p => p.results > 0).length > 0 ? prev7.reduce((s, p) => s + p.spend, 0) / prev7.reduce((s, p) => s + p.results, 0) : 0
      const notes: string[] = []
      if (avgSpend > 0 && d.spend > avgSpend * 1.5) notes.push(`Spend ${((d.spend / avgSpend - 1) * 100).toFixed(0)}% above avg`)
      if (avgSpend > 0 && d.spend < avgSpend * 0.5 && d.spend > 0) notes.push(`Spend ${((1 - d.spend / avgSpend) * 100).toFixed(0)}% below avg`)
      if (d.results === 0 && d.spend > 50 && avgResults > 1) notes.push('Zero results with spend')
      const dayCpr = d.results > 0 ? d.spend / d.results : 0
      if (dayCpr > 0 && avgCpr > 0 && dayCpr > avgCpr * 2) notes.push(`CPR ${((dayCpr / avgCpr - 1) * 100).toFixed(0)}% above avg`)
      if (dayCpr > 0 && avgCpr > 0 && dayCpr < avgCpr * 0.5) notes.push(`CPR ${((1 - dayCpr / avgCpr) * 100).toFixed(0)}% below avg`)
      if (notes.length) flags[d.date] = notes
    }
    return flags
  }, [daily])

  // Pacing: project end of month spend
  const pacingData = useMemo(() => {
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate() - 1 // yesterday
    const monthDays = daily.filter(d => {
      const dd = new Date(d.date + 'T12:00:00')
      return dd.getMonth() === now.getMonth() && dd.getFullYear() === now.getFullYear()
    })
    const monthSpend = monthDays.reduce((s, d) => s + d.spend, 0)
    const monthResults = monthDays.reduce((s, d) => s + d.results, 0)
    const avgDaily = dayOfMonth > 0 ? monthSpend / dayOfMonth : 0
    const projected = avgDaily * daysInMonth
    const projectedResults = dayOfMonth > 0 ? (monthResults / dayOfMonth) * daysInMonth : 0
    return { monthSpend, monthResults, avgDaily, projected, projectedResults, dayOfMonth, daysInMonth, daysRemaining: daysInMonth - dayOfMonth }
  }, [daily])

  // Sticky header scroll tracking
  const [showStickyKpi, setShowStickyKpi] = useState(false)
  useEffect(() => {
    const handleScroll = () => setShowStickyKpi(window.scrollY > 280)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const tabKeys: Record<string, string> = { '1': 'overview', '2': 'deepdive', '3': 'ads', '4': 'campaigns', '5': 'daily', '6': 'audience', '7': 'placements', '8': 'geographic' }
      if (tabKeys[e.key]) { e.preventDefault(); setActiveTab(tabKeys[e.key]) }
      if (e.key === '?') { e.preventDefault(); alert('Keyboard Shortcuts:\n1-8: Switch tabs\nEsc: Close modal') }
      if (e.key === 'Escape' && selectedAd) { setSelectedAd(null) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedAd])

  // Data freshness
  const lastDate = daily.length > 0 ? daily[daily.length - 1].date : null
  const freshnessLabel = lastDate ? `Data through ${new Date(lastDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''

  return (
    <>
    {/* Spacer */}

    {/* Sticky KPI Header */}
    {showStickyKpi && (
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#e8e8ec] shadow-sm">
        <div className="max-w-[1440px] mx-auto px-6 py-2 flex items-center gap-6">
          <span className="text-[13px] font-semibold text-[#111113] truncate max-w-[180px]">{clientName}</span>
          <div className="w-px h-4 bg-[#e8e8ec]" />
          <div className="flex items-center gap-5 text-[11px] overflow-x-auto">
            <div><span className="text-[#9d9da8]">Spend </span><span className="font-semibold tabular-nums">{formatCurrency(twSum('spend'))}</span></div>
            <div><span className="text-[#9d9da8]">{resultLabel} </span><span className="font-semibold tabular-nums">{formatNumber(twSum('results'))}</span></div>
            <div><span className="text-[#9d9da8]">CPR </span><span className={`font-semibold tabular-nums ${targetCpl && twSum('results') > 0 && twSum('spend') / twSum('results') > targetCpl ? 'text-[#dc2626]' : twSum('results') > 0 ? 'text-[#16a34a]' : ''}`}>{twSum('results') > 0 ? formatCurrency(twSum('spend') / twSum('results')) : '—'}</span></div>
            <div><span className="text-[#9d9da8]">CTR </span><span className="font-semibold tabular-nums">{twSum('impressions') > 0 ? formatPercent((twSum('clicks') / twSum('impressions')) * 100) : '—'}</span></div>
            <div><span className="text-[#9d9da8] text-[10px]">{daily.length}d</span></div>
            {targetCpl && <div><span className="text-[#9d9da8]">Target </span><span className="font-semibold tabular-nums">{formatCurrency(targetCpl)}</span></div>}
          </div>
        </div>
      </div>
    )}

    {/* Quick Actions — cross-links to creative tools */}
    {!portalMode && (
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-[#c4c4cc] font-semibold mr-1">Quick Actions</span>
        <a href={`/pegasus?client=${clientId}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#6b6b76] bg-[#f4f4f6] hover:bg-[#e8e8ec] hover:text-[#111113] rounded transition-colors">
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L4 7v7a2 2 0 002 2h8a2 2 0 002-2V7l-6-5z" /><path d="M10 16V10" /></svg>
          Ask Pegasus
        </a>
        <a href={`/copywriter?client=${clientId}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#6b6b76] bg-[#f4f4f6] hover:bg-[#e8e8ec] hover:text-[#111113] rounded transition-colors">
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" /><path d="M11 6l3 3" /></svg>
          Generate Copy
        </a>
        <a href={`/creative-studio?client=${clientId}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#6b6b76] bg-[#f4f4f6] hover:bg-[#e8e8ec] hover:text-[#111113] rounded transition-colors">
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l4-7h6l4 7-4 7H7l-4-7z" /></svg>
          Image Studio
        </a>
        <a href={`/ad-library?client=${clientId}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#6b6b76] bg-[#f4f4f6] hover:bg-[#e8e8ec] hover:text-[#111113] rounded transition-colors">
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="12" y="3" width="5" height="5" rx="1" /><rect x="3" y="12" width="5" height="5" rx="1" /><rect x="12" y="12" width="5" height="5" rx="1" /></svg>
          Ad Library
        </a>
      </div>
    )}

    <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== 'ads') setCampaignFilter(null) }}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="deepdive">Deep Dive</TabsTrigger>
        <TabsTrigger value="ads">Ads <span className="ml-1 text-[10px] bg-[#f4f4f6] px-1.5 py-0.5 rounded-full">{ads.length}</span></TabsTrigger>
        <TabsTrigger value="campaigns">Ads Manager <span className="ml-1 text-[10px] bg-[#f4f4f6] px-1.5 py-0.5 rounded-full">{campaigns.length}</span></TabsTrigger>
        <TabsTrigger value="daily">Daily <span className="ml-1 text-[10px] bg-[#f4f4f6] px-1.5 py-0.5 rounded-full">{daily.length}d</span></TabsTrigger>
        {ageGender.length > 0 && <TabsTrigger value="audience">Audience</TabsTrigger>}
        {placement.length > 0 && <TabsTrigger value="placements">Placements</TabsTrigger>}
        {region.length > 0 && <TabsTrigger value="geographic">Geographic</TabsTrigger>}
        {!portalMode && <TabsTrigger value="creative-analysis">Creative Analysis</TabsTrigger>}
        {!portalMode && <TabsTrigger value="settings">Settings</TabsTrigger>}
      </TabsList>

      {/* ═══════════════════ OVERVIEW ═══════════════════ */}
      <TabsContent value="overview">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
              <h3 className="text-[13px] font-semibold">Performance Trend</h3>
              <div className="flex flex-wrap items-center gap-1">
                {metricButtons.map(m => (
                  <button key={m.key} onClick={() => toggleMetric(m.key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                      chartMetrics.has(m.key) ? 'text-white shadow-sm' : 'text-[#9d9da8] bg-[#f4f4f6] hover:bg-[#e8e8ec]'
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
                {chartMetrics.has('spend') && daily.length >= 14 && <Area yAxisId="left" type="monotone" dataKey="ma_spend" stroke="#2563eb" fill="none" name="Spend 7d MA" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />}
                {chartMetrics.has('results') && daily.length >= 14 && <Area yAxisId="right" type="monotone" dataKey="ma_results" stroke="#16a34a" fill="none" name={`${resultLabel} 7d MA`} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />}
                {chartMetrics.has('cpr') && daily.length >= 14 && <Area yAxisId="left" type="monotone" dataKey="ma_cpr" stroke="#f59e0b" fill="none" name="CPR 7d MA" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />}
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatBox label="Spend" value={formatCurrency(twSum('spend'))} icon="$" sparkData={daily.map(d => d.spend)} sparkLabels={daily.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))} sparkFormat={v => formatCurrency(v)} sub={`${formatCurrency(twSum('spend') / (daily.length || 1))}/day avg`} change={wowChange(tw2Sum('spend'), lw2Sum('spend'))} />
            <StatBox label={resultLabel} value={formatNumber(twSum('results'))} sparkData={daily.map(d => d.results)} sparkColor="#16a34a" sparkLabels={daily.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))} sparkFormat={v => formatNumber(v)} sub={`${(twSum('results') / (daily.length || 1)).toFixed(1)}/day avg`} change={wowChange(tw2Sum('results'), lw2Sum('results'))} />
            <StatBox label="CPR" value={twSum('results') > 0 ? formatCurrency(twSum('spend') / twSum('results')) : '—'} sparkData={daily.map(d => d.results > 0 ? d.spend / d.results : 0)} sparkColor="#f59e0b" sparkLabels={daily.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))} sparkFormat={v => v > 0 ? formatCurrency(v) : '—'} sub={`Over ${daily.length} days`} change={wowChangeCPL(tw2Sum('results') > 0 ? tw2Sum('spend')/tw2Sum('results') : 0, lw2Sum('results') > 0 ? lw2Sum('spend')/lw2Sum('results') : 0)} />
            <StatBox label="Impressions" value={formatNumber(twSum('impressions'))} sparkData={daily.map(d => d.impressions)} sparkLabels={daily.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))} sparkFormat={v => formatNumber(v)} change={wowChange(tw2Sum('impressions'), lw2Sum('impressions'))} />
            <StatBox label="Clicks" value={formatNumber(twSum('clicks'))} sparkData={daily.map(d => d.clicks)} sparkColor="#06b6d4" sparkLabels={daily.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))} sparkFormat={v => formatNumber(v)} change={wowChange(tw2Sum('clicks'), lw2Sum('clicks'))} />
            <StatBox label="CTR" value={twSum('impressions') > 0 ? formatPercent((twSum('clicks') / twSum('impressions')) * 100) : '—'} sparkData={daily.map(d => d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0)} sparkColor="#ec4899" sparkLabels={daily.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))} sparkFormat={v => formatPercent(v)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {topAds.length > 0 && (
              <Card className="p-5">
                <h3 className="text-[13px] font-semibold text-[#16a34a] mb-3">Top Performers</h3>
                <div className="space-y-3">
                  {topAds.map((ad, i) => (
                    <div key={ad.platform_ad_id} className="flex items-center gap-3 cursor-pointer hover:bg-[#fafafb] rounded p-1.5 -m-1.5 transition-colors" onClick={() => setSelectedAd(ad)}>
                      <AdImage src={ad.creative_url || ad.creative_thumbnail_url} alt={ad.ad_name} className="w-10 h-10 rounded flex-shrink-0" />
                      <span className="w-5 h-5 rounded-full bg-[#dcfce7] text-[#16a34a] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{ad.ad_name}</p>
                        <p className="text-[11px] text-[#9d9da8]">{formatCurrency(ad.spend)} spent · {ad.results} {ad.result_label}</p>
                      </div>
                      <span className="text-[13px] font-semibold text-[#16a34a] tabular-nums">{formatCurrency(ad.cpr)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {bottomAds.length > 0 && (
              <Card className="p-5">
                <h3 className="text-[13px] font-semibold text-[#dc2626] mb-3">Underperformers</h3>
                <div className="space-y-3">
                  {bottomAds.map((ad, i) => (
                    <div key={ad.platform_ad_id} className="flex items-center gap-3 cursor-pointer hover:bg-[#fafafb] rounded p-1.5 -m-1.5 transition-colors" onClick={() => setSelectedAd(ad)}>
                      <AdImage src={ad.creative_url || ad.creative_thumbnail_url} alt={ad.ad_name} className="w-10 h-10 rounded flex-shrink-0" />
                      <span className="w-5 h-5 rounded-full bg-[#fef2f2] text-[#dc2626] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{ad.ad_name}</p>
                        <p className="text-[11px] text-[#9d9da8]">{formatCurrency(ad.spend)} spent · {ad.results} {ad.result_label}</p>
                      </div>
                      <span className="text-[13px] font-semibold text-[#dc2626] tabular-nums">{formatCurrency(ad.cpr)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Funnel — compact horizontal */}
          {funnelSteps.length > 1 && (
            <Card className="p-5">
              <h3 className="text-[13px] font-semibold mb-4">Conversion Funnel</h3>
              <div className="flex items-center gap-2">
                {funnelSteps.map((step, i) => {
                  const maxVal = funnelSteps[0].value || 1
                  const pct = (step.value / maxVal) * 100
                  return (
                    <div key={step.label} className="flex items-center gap-2 flex-1">
                      <div className="flex-1 text-center">
                        <p className="text-[18px] font-semibold tabular-nums">{formatCompact(step.value)}</p>
                        <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">{step.label}</p>
                        {step.rate !== undefined && <p className="text-[10px] font-medium text-[#16a34a] mt-0.5">{formatPercent(step.rate)}</p>}
                      </div>
                      {i < funnelSteps.length - 1 && <svg className="w-3 h-3 text-[#d4d4d8] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4l6 6-6 6" /></svg>}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>
      </TabsContent>

      {/* ═══════════════════ DEEP DIVE ═══════════════════ */}
      <TabsContent value="deepdive">
        {(() => {
          // === Data Processing ===
          const totalSpendAll = daily.reduce((s, d) => s + d.spend, 0)
          const totalResultsAll = daily.reduce((s, d) => s + d.results, 0)
          const totalImpressions = daily.reduce((s, d) => s + d.impressions, 0)
          const totalClicks = daily.reduce((s, d) => s + d.clicks, 0)
          const overallCpr = totalResultsAll > 0 ? totalSpendAll / totalResultsAll : 0
          const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
          const convRate = totalClicks > 0 ? (totalResultsAll / totalClicks) * 100 : 0
          const costPerClick = totalClicks > 0 ? totalSpendAll / totalClicks : 0
          const cpm = totalImpressions > 0 ? (totalSpendAll / totalImpressions) * 1000 : 0
          const lpvTotal = daily.reduce((s, d) => s + (d.landing_page_views || 0), 0)
          const lpvRate = totalClicks > 0 ? (lpvTotal / totalClicks) * 100 : 0

          // Day-of-week analysis
          const dowData: Record<string, { spend: number; results: number; impressions: number; clicks: number; days: number }> = {}
          const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          daily.forEach(d => {
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

          // Week-over-week trends (4 weeks)
          const weeklyData: { week: string; spend: number; results: number; cpr: number }[] = []
          for (let w = 0; w < Math.min(4, Math.ceil(daily.length / 7)); w++) {
            const slice = daily.slice(-(w + 1) * 7, w === 0 ? undefined : -w * 7)
            const wSpend = slice.reduce((s, d) => s + d.spend, 0)
            const wResults = slice.reduce((s, d) => s + d.results, 0)
            weeklyData.unshift({ week: `W${Math.min(4, Math.ceil(daily.length / 7)) - w}`, spend: wSpend, results: wResults, cpr: wResults > 0 ? wSpend / wResults : 0 })
          }

          // Campaign efficiency
          const campaignsWithData = campaigns.filter(c => c.spend > 0 && c.results > 0).sort((a, b) => a.cpr - b.cpr)
          const topCampaign = campaignsWithData[0]
          const worstCampaign = campaignsWithData[campaignsWithData.length - 1]
          const campaignCount = campaigns.filter(c => c.spend > 0).length

          // Ad fatigue detection: ads with spend but declining or zero results
          const adsWithSpend = ads.filter(a => a.spend > 50)
          const fatiguedAds = adsWithSpend.filter(a => a.spend > 100 && a.results === 0)
          const highCprAds = adsWithSpend.filter(a => a.results > 0 && targetCpl && a.cpr > targetCpl * 2).sort((a, b) => b.spend - a.spend)
          const wastedSpend = fatiguedAds.reduce((s, a) => s + a.spend, 0) + highCprAds.reduce((s, a) => s + Math.max(0, a.spend - (targetCpl ? targetCpl * a.results : 0)), 0)

          // Creative analysis
          const isVideoAd = (a: any) => a.creative_video_url || a.creative_url?.includes('/t15.5256-10/') || a.creative_url?.includes('/t15.13418-10/')
          const videoAds = ads.filter(a => isVideoAd(a) && a.spend > 0)
          const imageAds = ads.filter(a => !isVideoAd(a) && a.spend > 0)
          const videoResults = videoAds.reduce((s, a) => s + a.results, 0)
          const videoSpend = videoAds.reduce((s, a) => s + a.spend, 0)
          const imageResults = imageAds.reduce((s, a) => s + a.results, 0)
          const imageSpend = imageAds.reduce((s, a) => s + a.spend, 0)
          const videoCpr = videoResults > 0 ? videoSpend / videoResults : 0
          const imageCpr = imageResults > 0 ? imageSpend / imageResults : 0

          // Headline analysis
          const headlineMap = new Map<string, { spend: number; results: number; count: number }>()
          for (const a of ads.filter(a => a.creative_headline && a.spend > 0)) {
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
          const top3Ads = [...ads].filter(a => a.spend > 0).sort((a, b) => b.spend - a.spend).slice(0, 3)
          const top3Spend = top3Ads.reduce((s, a) => s + a.spend, 0)
          const top3Pct = totalSpendAll > 0 ? (top3Spend / totalSpendAll) * 100 : 0

          // Zero-result days
          const zeroDays = daily.filter(d => d.spend > 0 && d.results === 0)
          const overTargetDays = targetCpl ? daily.filter(d => d.results > 0 && (d.spend / d.results) > targetCpl) : []

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
                  <div>
                    <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Month Spend</p>
                    <p className="text-[18px] font-semibold tabular-nums mt-0.5">{formatCurrency(pacingData.monthSpend)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Projected Spend</p>
                    <p className="text-[18px] font-semibold tabular-nums mt-0.5">{formatCurrency(pacingData.projected)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Avg/Day</p>
                    <p className="text-[18px] font-semibold tabular-nums mt-0.5">{formatCurrency(pacingData.avgDaily)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Month {resultLabel}</p>
                    <p className="text-[18px] font-semibold tabular-nums mt-0.5">{formatNumber(pacingData.monthResults)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Proj. {resultLabel}</p>
                    <p className="text-[18px] font-semibold tabular-nums mt-0.5">{formatNumber(Math.round(pacingData.projectedResults))}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 bg-[#f4f4f6] rounded-full overflow-hidden">
                  <div className="h-full bg-[#2563eb] rounded-full transition-all" style={{ width: `${Math.min((pacingData.dayOfMonth / pacingData.daysInMonth) * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-[#9d9da8]">
                  <span>{((pacingData.dayOfMonth / pacingData.daysInMonth) * 100).toFixed(0)}% through month</span>
                  <span>{pacingData.daysRemaining} days remaining</span>
                </div>
              </Card>

              {/* Scatter Plot: Spend vs CPR per Ad */}
              {(() => {
                const scatterAds = ads.filter(a => a.spend > 10 && a.results > 0).map(a => ({
                  name: a.ad_name,
                  spend: a.spend,
                  cpr: a.cpr,
                  results: a.results,
                  campaign: a.campaign_name,
                }))
                if (scatterAds.length < 3) return null
                const maxSpend = Math.max(...scatterAds.map(a => a.spend))
                const maxCpr = Math.max(...scatterAds.map(a => a.cpr))
                return (
                  <Card className="p-5">
                    <h3 className="text-[13px] font-semibold mb-1">Ad Efficiency Map</h3>
                    <p className="text-[11px] text-[#9d9da8] mb-4">Each dot is an ad. Bottom-right = high spend, low CPR (ideal).</p>
                    <div className="relative" style={{ height: 300 }}>
                      {/* Y axis label */}
                      <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-[9px] text-[#9d9da8] tabular-nums">
                        <span>{formatCurrency(maxCpr)}</span>
                        <span>{formatCurrency(maxCpr / 2)}</span>
                        <span>$0</span>
                      </div>
                      {/* X axis label */}
                      <div className="absolute left-10 right-0 bottom-0 h-4 flex justify-between text-[9px] text-[#9d9da8] tabular-nums">
                        <span>$0</span>
                        <span>{formatCurrency(maxSpend / 2)}</span>
                        <span>{formatCurrency(maxSpend)}</span>
                      </div>
                      {/* Grid */}
                      <div className="absolute left-10 right-0 top-0 bottom-8 border-l border-b border-[#e8e8ec]">
                        <div className="absolute inset-0 border-t border-r border-[#f4f4f6]" />
                        {/* Target line */}
                        {targetCpl && targetCpl < maxCpr && (
                          <div className="absolute left-0 right-0 border-t border-dashed border-[#dc2626]/30" style={{ top: `${(1 - targetCpl / maxCpr) * 100}%` }}>
                            <span className="absolute right-0 -top-3 text-[9px] text-[#dc2626]">Target {formatCurrency(targetCpl)}</span>
                          </div>
                        )}
                        {/* Dots */}
                        {scatterAds.map((a, i) => {
                          const x = (a.spend / maxSpend) * 100
                          const y = (1 - a.cpr / maxCpr) * 100
                          const isOver = targetCpl ? a.cpr > targetCpl : false
                          const size = Math.max(6, Math.min(16, (a.results / Math.max(...scatterAds.map(s => s.results))) * 16))
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
                      {/* Axis labels */}
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-[#9d9da8]">Spend →</div>
                      <div className="absolute top-1/2 -left-1 -translate-y-1/2 -rotate-90 text-[9px] text-[#9d9da8]">CPR →</div>
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
                const p1 = daily.slice(0, halfLen)
                const p2 = daily.slice(halfLen)
                const p1Start = new Date(p1[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const p1End = new Date(p1[p1.length - 1].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const p2Start = new Date(p2[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const p2End = new Date(p2[p2.length - 1].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const metrics = [
                  { label: 'Spend', p1: p1.reduce((s, d) => s + d.spend, 0), p2: p2.reduce((s, d) => s + d.spend, 0), fmt: formatCurrency },
                  { label: resultLabel, p1: p1.reduce((s, d) => s + d.results, 0), p2: p2.reduce((s, d) => s + d.results, 0), fmt: formatNumber },
                  { label: 'CPR', p1: p1.reduce((s, d) => s + d.results, 0) > 0 ? p1.reduce((s, d) => s + d.spend, 0) / p1.reduce((s, d) => s + d.results, 0) : 0, p2: p2.reduce((s, d) => s + d.results, 0) > 0 ? p2.reduce((s, d) => s + d.spend, 0) / p2.reduce((s, d) => s + d.results, 0) : 0, fmt: formatCurrency, invert: true },
                  { label: 'Impressions', p1: p1.reduce((s, d) => s + d.impressions, 0), p2: p2.reduce((s, d) => s + d.impressions, 0), fmt: formatNumber },
                  { label: 'Clicks', p1: p1.reduce((s, d) => s + d.clicks, 0), p2: p2.reduce((s, d) => s + d.clicks, 0), fmt: formatNumber },
                  { label: 'CTR', p1: p1.reduce((s, d) => s + d.impressions, 0) > 0 ? (p1.reduce((s, d) => s + d.clicks, 0) / p1.reduce((s, d) => s + d.impressions, 0)) * 100 : 0, p2: p2.reduce((s, d) => s + d.impressions, 0) > 0 ? (p2.reduce((s, d) => s + d.clicks, 0) / p2.reduce((s, d) => s + d.impressions, 0)) * 100 : 0, fmt: formatPercent },
                ]
                return (
                  <Card className="p-5">
                    <h3 className="text-[13px] font-semibold mb-4">Period Comparison</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="border-b border-[#e8e8ec]">
                            <th className="py-2 px-3 text-left text-[10px] text-[#9d9da8] uppercase tracking-wider">Metric</th>
                            <th className="py-2 px-3 text-right text-[10px] text-[#9d9da8] uppercase tracking-wider">{p1Start} – {p1End}</th>
                            <th className="py-2 px-3 text-right text-[10px] text-[#9d9da8] uppercase tracking-wider">{p2Start} – {p2End}</th>
                            <th className="py-2 px-3 text-right text-[10px] text-[#9d9da8] uppercase tracking-wider">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.map(m => {
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
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )
              })()}

              {/* Funnel Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <Card className="p-4">
                  <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">CPM</p>
                  <p className="text-[18px] font-semibold tabular-nums mt-1">{formatCurrency(cpm)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">CPC</p>
                  <p className="text-[18px] font-semibold tabular-nums mt-1">{formatCurrency(costPerClick)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">CTR</p>
                  <p className="text-[18px] font-semibold tabular-nums mt-1">{formatPercent(overallCtr)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Conv Rate</p>
                  <p className="text-[18px] font-semibold tabular-nums mt-1">{formatPercent(convRate)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">LPV Rate</p>
                  <p className="text-[18px] font-semibold tabular-nums mt-1">{lpvTotal > 0 ? formatPercent(lpvRate) : '—'}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Cost / {resultLabel.replace(/s$/, '')}</p>
                  <p className={`text-[18px] font-semibold tabular-nums mt-1 ${targetCpl && overallCpr > targetCpl ? 'text-[#dc2626]' : overallCpr > 0 ? 'text-[#16a34a]' : ''}`}>{overallCpr > 0 ? formatCurrency(overallCpr) : '—'}</p>
                </Card>
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
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#f4f4f6] text-[11px]">
                    <span className="text-[#9d9da8]">Avg spend/day</span>
                    <span className="text-[#9d9da8]">Avg results/day</span>
                    <span className="text-[#9d9da8]">CPR</span>
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
                              <div>
                                <span className="text-[#9d9da8] text-[10px]">CPR</span>
                                <p className="font-semibold tabular-nums">{w.cpr > 0 ? formatCurrency(w.cpr) : '—'}
                                  {cprChange !== null && <span className={`ml-1 text-[10px] ${cprChange > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{cprChange > 0 ? '+' : ''}{cprChange.toFixed(0)}%</span>}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : <p className="text-[12px] text-[#9d9da8]">Need 2+ weeks of data</p>}
                </Card>
              </div>

              {/* Spend Efficiency Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="p-5">
                  <h3 className="text-[13px] font-semibold mb-3">Spend Concentration</h3>
                  <div className="space-y-3 text-[12px]">
                    <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                      <span className="text-[#9d9da8]">Active ads</span>
                      <span className="font-medium">{ads.filter(a => a.effective_status === 'ACTIVE').length} of {ads.length}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                      <span className="text-[#9d9da8]">Top 3 ads % of spend</span>
                      <span className="font-medium">{top3Pct.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                      <span className="text-[#9d9da8]">Active campaigns</span>
                      <span className="font-medium">{campaignCount}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                      <span className="text-[#9d9da8]">Ads with $0 results</span>
                      <span className={`font-medium ${fatiguedAds.length > 0 ? 'text-[#dc2626]' : ''}`}>{fatiguedAds.length}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[#9d9da8]">Est. wasted spend</span>
                      <span className={`font-semibold ${wastedSpend > 0 ? 'text-[#dc2626]' : ''}`}>{formatCurrency(wastedSpend)}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="text-[13px] font-semibold mb-3">Consistency</h3>
                  <div className="space-y-3 text-[12px]">
                    <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                      <span className="text-[#9d9da8]">Days analyzed</span>
                      <span className="font-medium">{daily.length}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                      <span className="text-[#9d9da8]">Days with results</span>
                      <span className="font-medium">{daysWithResults.length} ({daily.length > 0 ? ((daysWithResults.length / daily.length) * 100).toFixed(0) : 0}%)</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                      <span className="text-[#9d9da8]">Zero-result days</span>
                      <span className={`font-medium ${zeroDays.length > 3 ? 'text-[#dc2626]' : ''}`}>{zeroDays.length}</span>
                    </div>
                    {targetCpl && (
                      <>
                        <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                          <span className="text-[#9d9da8]">Days over target</span>
                          <span className={`font-medium ${overTargetDays.length > daily.length * 0.5 ? 'text-[#dc2626]' : ''}`}>{overTargetDays.length} ({daily.length > 0 ? ((overTargetDays.length / Math.max(daysWithResults.length, 1)) * 100).toFixed(0) : 0}%)</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-[#9d9da8]">On-target rate</span>
                          <span className={`font-semibold ${(daysWithResults.length - overTargetDays.length) / Math.max(daysWithResults.length, 1) > 0.6 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{daysWithResults.length > 0 ? (((daysWithResults.length - overTargetDays.length) / daysWithResults.length) * 100).toFixed(0) : 0}%</span>
                        </div>
                      </>
                    )}
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="text-[13px] font-semibold mb-3">Creative Mix</h3>
                  <div className="space-y-3 text-[12px]">
                    <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                      <span className="text-[#9d9da8]">Image ads</span>
                      <span className="font-medium">{imageAds.length} ({imageSpend > 0 ? formatCurrency(imageCpr) + ' CPR' : 'no spend'})</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                      <span className="text-[#9d9da8]">Video ads</span>
                      <span className="font-medium">{videoAds.length} ({videoSpend > 0 ? formatCurrency(videoCpr) + ' CPR' : 'no spend'})</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                      <span className="text-[#9d9da8]">Better format</span>
                      <span className={`font-semibold ${videoCpr > 0 && imageCpr > 0 ? (videoCpr < imageCpr ? 'text-[#8b5cf6]' : 'text-[#2563eb]') : ''}`}>
                        {videoCpr > 0 && imageCpr > 0 ? (videoCpr < imageCpr ? 'Video' : 'Image') : '—'}
                        {videoCpr > 0 && imageCpr > 0 && <span className="text-[#9d9da8] font-normal ml-1">by {Math.abs(((Math.min(videoCpr, imageCpr) / Math.max(videoCpr, imageCpr)) - 1) * 100).toFixed(0)}%</span>}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#f4f4f6]">
                      <span className="text-[#9d9da8]">Unique headlines</span>
                      <span className="font-medium">{headlineMap.size}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[#9d9da8]">Unique CTAs</span>
                      <span className="font-medium">{new Set(ads.filter(a => a.creative_cta).map(a => a.creative_cta)).size}</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Campaign Rankings + Wasted Spend (side by side) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {campaignsWithData.length > 0 && (
                  <Card>
                    <div className="px-5 py-4 border-b border-[#e8e8ec]">
                      <h3 className="text-[13px] font-semibold">Campaign Efficiency Ranking</h3>
                    </div>
                    <div className="divide-y divide-[#f4f4f6]">
                      {campaignsWithData.slice(0, 8).map((c, i) => (
                        <div key={c.platform_campaign_id} className="flex items-center gap-3 px-5 py-3">
                          <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${i < 3 ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#f4f4f6] text-[#9d9da8]'}`}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate">{c.campaign_name}</p>
                            <p className="text-[10px] text-[#9d9da8]">{c.results} {resultLabel.toLowerCase()} · {formatCurrency(c.spend)} spent</p>
                          </div>
                          <span className={`text-[12px] font-semibold tabular-nums ${targetCpl && c.cpr > targetCpl ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(c.cpr)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {(fatiguedAds.length > 0 || highCprAds.length > 0) && (
                  <Card>
                    <div className="px-5 py-4 border-b border-[#e8e8ec] flex items-center justify-between">
                      <h3 className="text-[13px] font-semibold">Wasted Spend Detection</h3>
                      <span className="text-[11px] text-[#dc2626] font-medium">{formatCurrency(wastedSpend)} potential waste</span>
                    </div>
                    <div className="divide-y divide-[#f4f4f6]">
                      {fatiguedAds.slice(0, 5).map(a => (
                        <div key={a.platform_ad_id} className="flex items-center gap-3 px-5 py-3">
                          <span className="w-5 h-5 rounded bg-[#fef2f2] text-[#dc2626] text-[10px] font-bold flex items-center justify-center flex-shrink-0">!</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate">{a.ad_name}</p>
                            <p className="text-[10px] text-[#dc2626]">Spent {formatCurrency(a.spend)} with 0 results</p>
                          </div>
                          <span className="text-[12px] font-semibold tabular-nums text-[#dc2626]">{formatCurrency(a.spend)}</span>
                        </div>
                      ))}
                      {highCprAds.slice(0, 5).map(a => (
                        <div key={a.platform_ad_id} className="flex items-center gap-3 px-5 py-3">
                          <span className="w-5 h-5 rounded bg-[#fff7ed] text-[#ea580c] text-[10px] font-bold flex items-center justify-center flex-shrink-0">!</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate">{a.ad_name}</p>
                            <p className="text-[10px] text-[#ea580c]">CPR {formatCurrency(a.cpr)} — {targetCpl ? `${((a.cpr / targetCpl - 1) * 100).toFixed(0)}% over target` : 'very high'}</p>
                          </div>
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
                  <div className="px-5 py-4 border-b border-[#e8e8ec]">
                    <h3 className="text-[13px] font-semibold">Headline Performance</h3>
                  </div>
                  <div className="divide-y divide-[#f4f4f6]">
                    {headlines.slice(0, 8).map((h, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3">
                        <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${i < 3 ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#f4f4f6] text-[#9d9da8]'}`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate">&ldquo;{h.headline}&rdquo;</p>
                          <p className="text-[10px] text-[#9d9da8]">{h.count} ad{h.count > 1 ? 's' : ''} · {h.results} {resultLabel.toLowerCase()}</p>
                        </div>
                        <span className={`text-[12px] font-semibold tabular-nums ${targetCpl && h.cpr > targetCpl ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(h.cpr)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* CTA Performance */}
              {(() => {
                const ctaMap = new Map<string, { spend: number; results: number; count: number }>()
                for (const a of ads.filter(a => a.creative_cta && a.spend > 0)) {
                  const c = a.creative_cta!
                  const existing = ctaMap.get(c) || { spend: 0, results: 0, count: 0 }
                  existing.spend += a.spend; existing.results += a.results; existing.count++
                  ctaMap.set(c, existing)
                }
                const ctas = Array.from(ctaMap.entries())
                  .map(([cta, data]) => ({ cta, ...data, cpr: data.results > 0 ? data.spend / data.results : Infinity }))
                  .filter(c => c.results >= 1)
                  .sort((a, b) => a.cpr - b.cpr)
                if (ctas.length < 2) return null
                return (
                  <Card>
                    <div className="px-5 py-4 border-b border-[#e8e8ec]">
                      <h3 className="text-[13px] font-semibold">CTA Performance</h3>
                    </div>
                    <div className="divide-y divide-[#f4f4f6]">
                      {ctas.map((c, i) => (
                        <div key={c.cta} className="flex items-center gap-3 px-5 py-3">
                          <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${i === 0 ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#f4f4f6] text-[#9d9da8]'}`}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium">{c.cta.replace(/_/g, ' ')}</p>
                            <p className="text-[10px] text-[#9d9da8]">{c.count} ad{c.count > 1 ? 's' : ''} · {c.results} {resultLabel.toLowerCase()} · {formatCurrency(c.spend)} spent</p>
                          </div>
                          <span className={`text-[12px] font-semibold tabular-nums ${targetCpl && c.cpr > targetCpl ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{c.cpr < Infinity ? formatCurrency(c.cpr) : '—'}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )
              })()}

              {/* Spend Distribution by Campaign — visual */}
              {campaigns.filter(c => c.spend > 0).length > 1 && (
                <Card className="p-5">
                  <h3 className="text-[13px] font-semibold mb-4">Spend Distribution</h3>
                  <div className="flex h-6 rounded overflow-hidden mb-4">
                    {campaigns.filter(c => c.spend > 0).sort((a, b) => b.spend - a.spend).map((c, i) => {
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
                    {campaigns.filter(c => c.spend > 0).sort((a, b) => b.spend - a.spend).slice(0, 6).map((c, i) => {
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
        })()}
      </TabsContent>

      {/* ═══════════════════ ADS ═══════════════════ */}
      <TabsContent value="ads">
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9d9da8]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
                <input value={adSearch} onChange={e => setAdSearch(e.target.value)} placeholder="Search ads..." className="pl-8 pr-3 py-1.5 text-[12px] bg-white border border-[#e8e8ec] rounded w-[200px] focus:outline-none focus:border-[#2563eb] placeholder-[#9d9da8]" />
              </div>
              <div className="flex items-center gap-1 bg-white border border-[#e8e8ec] rounded p-0.5">
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

          <div className="flex items-center gap-2">
            <p className="text-[12px] text-[#9d9da8]">{filteredAds.length} of {ads.length} ads</p>
            {campaignFilter && (
              <button onClick={() => setCampaignFilter(null)} className="flex items-center gap-1 px-2 py-0.5 bg-[#eff6ff] text-[#2563eb] text-[11px] font-medium rounded-full hover:bg-[#dbeafe] transition-colors">
                {campaigns.find(c => c.platform_campaign_id === campaignFilter)?.campaign_name?.slice(0, 30) || 'Campaign'}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" /></svg>
              </button>
            )}
          </div>

          {adsView === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAds.map((ad, idx) => {
                const imageUrl = ad.creative_url || ad.creative_thumbnail_url
                return (
                  <Card key={ad.platform_ad_id} className="overflow-hidden cursor-pointer card-hover" style={{ animationDelay: `${idx * 30}ms` }} onClick={() => setSelectedAd(ad)}>
                    <AdImage src={imageUrl} alt={ad.ad_name} className="w-full h-[180px]" />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[13px] font-medium truncate flex-1">{ad.ad_name}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
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
                  { key: 'ad_name', label: 'Ad', format: (v, row) => <div><button className="font-medium text-left hover:text-[#2563eb] transition-colors" onClick={() => setSelectedAd(row)}>{v}</button><p className="text-[10px] text-[#9d9da8] truncate max-w-[250px]">{row.campaign_name}</p></div> },
                  { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                  { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                  { key: 'cpr', label: 'CPR', format: (v: number) => {
                    if (v === 0) return <span className="text-[#c4c4cc]">—</span>
                    const isOver = targetCpl ? v > targetCpl : false
                    return <span className={`font-semibold ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(v)}</span>
                  }, align: 'right' },
                  { key: 'impressions', label: 'Impr', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'clicks', label: 'Clicks', format: (v) => formatNumber(v), align: 'right' },
                  { key: 'ctr', label: 'CTR', format: (v: number) => <span className="text-[#6b6b76]">{formatPercent(v)}</span>, align: 'right' },
                ]}
                data={filteredAds}
              />
            </Card>
          )}
        </div>

      </TabsContent>

      {/* ═══════════════════ CAMPAIGNS (Ads Manager Drill-Down) ═══════════════════ */}
      <TabsContent value="campaigns">
        <div className="space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[12px]">
            <button onClick={() => { setDrillLevel('campaigns'); setDrillCampaignId(null); setDrillAdSetId(null) }} className={`font-medium transition-colors ${drillLevel === 'campaigns' ? 'text-[#111113]' : 'text-[#2563eb] hover:underline'}`}>
              Campaigns ({campaigns.length})
            </button>
            {drillCampaignId && (
              <>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="#9d9da8"><path d="M7 4l6 6-6 6" /></svg>
                <button onClick={() => { setDrillLevel('adsets'); setDrillAdSetId(null) }} className={`font-medium truncate max-w-[200px] transition-colors ${drillLevel === 'adsets' ? 'text-[#111113]' : 'text-[#2563eb] hover:underline'}`}>
                  {campaigns.find(c => c.platform_campaign_id === drillCampaignId)?.campaign_name || 'Ad Sets'}
                </button>
              </>
            )}
            {drillAdSetId && (
              <>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="#9d9da8"><path d="M7 4l6 6-6 6" /></svg>
                <span className="font-medium text-[#111113] truncate max-w-[200px]">
                  {adSets.find(a => a.platform_ad_set_id === drillAdSetId)?.ad_set_name || 'Ads'}
                </span>
              </>
            )}
          </div>

          {/* ── Campaign Level ── */}
          {drillLevel === 'campaigns' && (
            <Card>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#e8e8ec]">
                      <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Campaign</th>
                      <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Spend</th>
                      <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">{resultLabel}</th>
                      <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPR</th>
                      <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CTR</th>
                      <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Ad Sets</th>
                      <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Ads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => {
                      const campAdSets = adSets.filter(a => a.platform_campaign_id === c.platform_campaign_id)
                      const campAds = ads.filter(a => a.platform_campaign_id === c.platform_campaign_id)
                      const isOver = targetCpl && c.cpr > 0 ? c.cpr > targetCpl : false
                      return (
                        <tr key={c.platform_campaign_id} className="border-b border-[#f4f4f6] hover:bg-[#fafafb] cursor-pointer transition-colors" onClick={() => { setDrillLevel('adsets'); setDrillCampaignId(c.platform_campaign_id) }}>
                          <td className="py-3 px-4">
                            <p className="font-medium text-[#2563eb] hover:underline">{c.campaign_name}</p>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium">{formatCurrency(c.spend)}</td>
                          <td className="py-3 px-4 text-right tabular-nums">{formatNumber(c.results)}</td>
                          <td className={`py-3 px-4 text-right tabular-nums font-semibold ${isOver ? 'text-[#dc2626]' : c.cpr > 0 ? 'text-[#16a34a]' : 'text-[#9d9da8]'}`}>
                            {c.cpr > 0 ? formatCurrency(c.cpr) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{formatPercent(c.ctr)}</td>
                          <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{campAdSets.length}</td>
                          <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{campAds.length}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ── Ad Set Level ── */}
          {drillLevel === 'adsets' && drillCampaignId && (() => {
            const campAdSets = adSets.filter(a => a.platform_campaign_id === drillCampaignId)
            return (
              <Card>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[#e8e8ec]">
                        <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Ad Set</th>
                        <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Status</th>
                        <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Budget</th>
                        <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Spend</th>
                        <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">{resultLabel}</th>
                        <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPR</th>
                        <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CTR</th>
                        <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Ads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campAdSets.length === 0 && (
                        <tr><td colSpan={8} className="py-8 text-center text-[#9d9da8] text-[13px]">No ad set data available</td></tr>
                      )}
                      {campAdSets.map(as => {
                        const asAds = ads.filter(a => a.platform_campaign_id === drillCampaignId)
                        const isOver = targetCpl && as.cpr > 0 ? as.cpr > targetCpl : false
                        return (
                          <tr key={as.platform_ad_set_id} className="border-b border-[#f4f4f6] hover:bg-[#fafafb] cursor-pointer transition-colors" onClick={() => { setDrillLevel('ads'); setDrillAdSetId(as.platform_ad_set_id) }}>
                            <td className="py-3 px-4">
                              <p className="font-medium text-[#2563eb] hover:underline">{as.ad_set_name}</p>
                              {as.optimization_goal && <p className="text-[10px] text-[#9d9da8] mt-0.5">{as.optimization_goal.replace(/_/g, ' ').toLowerCase()}</p>}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={as.status === 'ACTIVE' ? 'success' : 'neutral'}>
                                {(as.status || 'unknown').toLowerCase()}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">
                              {as.daily_budget ? `${formatCurrency(as.daily_budget)}/day` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-medium">{formatCurrency(as.spend)}</td>
                            <td className="py-3 px-4 text-right tabular-nums">{formatNumber(as.results)}</td>
                            <td className={`py-3 px-4 text-right tabular-nums font-semibold ${isOver ? 'text-[#dc2626]' : as.cpr > 0 ? 'text-[#16a34a]' : 'text-[#9d9da8]'}`}>
                              {as.cpr > 0 ? formatCurrency(as.cpr) : '—'}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{formatPercent(as.ctr)}</td>
                            <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{asAds.length}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          })()}

          {/* ── Ad Level (within campaign drill-down) ── */}
          {drillLevel === 'ads' && drillAdSetId && (() => {
            // Filter ads that belong to this ad set — we need to match via the insights data
            // Since ads don't directly store platform_ad_set_id, filter by campaign for now
            const drillAds = ads.filter(a => a.platform_campaign_id === drillCampaignId)
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {drillAds.length === 0 && <p className="text-[13px] text-[#9d9da8] col-span-3 text-center py-8">No ads found</p>}
                {drillAds.map(ad => {
                  const imageUrl = ad.creative_url || ad.creative_thumbnail_url
                  return (
                    <Card key={ad.platform_ad_id} className="overflow-hidden cursor-pointer hover:shadow-md hover:border-[#c4c4cc] transition-all" onClick={() => setSelectedAd(ad)}>
                      <AdImage src={imageUrl} alt={ad.ad_name} className="w-full h-[160px]" />
                      <div className="p-3">
                        <p className="text-[12px] font-medium truncate mb-2">{ad.ad_name}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div><span className="text-[#9d9da8]">Spend</span><p className="font-semibold tabular-nums">{formatCurrency(ad.spend)}</p></div>
                          <div><span className="text-[#9d9da8]">{resultLabel}</span><p className="font-semibold tabular-nums">{ad.results}</p></div>
                          <div><span className="text-[#9d9da8]">CPR</span><p className={`font-semibold tabular-nums ${ad.cpr > 0 ? (targetCpl && ad.cpr > targetCpl ? 'text-[#dc2626]' : 'text-[#16a34a]') : 'text-[#c4c4cc]'}`}>{ad.cpr > 0 ? formatCurrency(ad.cpr) : '—'}</p></div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </TabsContent>

      {/* ═══════════════════ DAILY ═══════════════════ */}
      <TabsContent value="daily">
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBox label="Total Spend" value={formatCurrency(daily.reduce((s, d) => s + d.spend, 0))} sub={`~${formatCurrency(daily.reduce((s, d) => s + d.spend, 0) / (daily.length || 1))}/day`} icon="$" sparkData={daily.map(d => d.spend)} sparkLabels={daily.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))} sparkFormat={v => formatCurrency(v)} change={wowChange(tw2Sum('spend'), lw2Sum('spend'))} />
            <StatBox label={`Total ${resultLabel}`} value={formatNumber(daily.reduce((s, d) => s + d.results, 0))} sub={`~${(daily.reduce((s, d) => s + d.results, 0) / (daily.length || 1)).toFixed(1)}/day`} sparkData={daily.map(d => d.results)} sparkColor="#16a34a" sparkLabels={daily.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))} sparkFormat={v => formatNumber(v)} change={wowChange(tw2Sum('results'), lw2Sum('results'))} />
            <StatBox label="Avg CPR" value={totalResults > 0 ? formatCurrency(daily.reduce((s, d) => s + d.spend, 0) / totalResults) : '—'} sub={`Over ${daily.length} days`} sparkData={daily.map(d => d.results > 0 ? d.spend / d.results : 0)} sparkColor="#f59e0b" />
            {bestDay && <StatBox label="Best Day" value={new Date(bestDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} sub={`${formatCurrency(bestDay.spend / bestDay.results)} CPR · ${bestDay.results} ${resultLabel.toLowerCase()}`} highlight={true} />}
          </div>

          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec] flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Daily Breakdown</h3>
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
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Impr</th>
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Clicks</th>
                    <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {[...daily].reverse().map(d => {
                    const cpr = d.results > 0 ? d.spend / d.results : 0
                    const isOver = targetCpl ? cpr > targetCpl : false
                    const isBest = bestDay && d.date === bestDay.date
                    const ctrVal = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0
                    const dayOfWeek = new Date(d.date + 'T12:00:00').getDay()
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                    return (
                      <tr key={d.date} className={`border-b border-[#f4f4f6] hover:bg-[#fafafb] transition-colors ${isBest ? 'bg-[#fffbeb]' : isWeekend ? 'bg-[#fafafa]' : ''}`}>
                        <td className="py-2.5 px-4">
                          <span className={isWeekend ? 'text-[#9d9da8]' : ''}>{new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          {isBest && <span className="ml-1.5 text-[9px] font-semibold text-[#f59e0b]">BEST</span>}
                          {anomalies[d.date] && (
                            <span className="relative group ml-1">
                              <span className="inline-block w-3.5 h-3.5 rounded bg-[#fef2f2] text-[#dc2626] text-[8px] font-bold text-center leading-[14px] cursor-default">!</span>
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 pointer-events-none bg-[#111113] text-white rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-lg">
                                {anomalies[d.date].join(' · ')}
                              </span>
                            </span>
                          )}
                          {notes[d.date] && editingNote !== d.date && (
                            <button onClick={(e) => { e.stopPropagation(); setEditingNote(d.date); setNoteText(notes[d.date]) }} className="ml-1 relative group">
                              <span className="inline-block w-3.5 h-3.5 rounded bg-[#eff6ff] text-[#2563eb] text-[8px] font-bold text-center leading-[14px]">N</span>
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 pointer-events-none bg-[#111113] text-white rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-lg max-w-[200px]">
                                {notes[d.date]}
                              </span>
                            </button>
                          )}
                          {!notes[d.date] && editingNote !== d.date && (
                            <button onClick={(e) => { e.stopPropagation(); setEditingNote(d.date); setNoteText('') }} className="ml-1 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity">
                              <span className="inline-block w-3.5 h-3.5 rounded bg-[#f4f4f6] text-[#9d9da8] text-[8px] text-center leading-[14px]">+</span>
                            </button>
                          )}
                          {editingNote === d.date && (
                            <div className="ml-2 flex items-center gap-1">
                              <input autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNote(d.date, noteText); if (e.key === 'Escape') setEditingNote(null) }} className="text-[11px] border border-[#2563eb] rounded px-1.5 py-0.5 w-[160px] focus:outline-none" placeholder="Add note..." />
                              <button onClick={() => saveNote(d.date, noteText)} className="text-[10px] text-[#2563eb] font-medium">Save</button>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4"><div className="h-[6px] bg-[#f4f4f6] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(d.spend / maxDailySpend) * 100}%`, backgroundColor: d.results > 0 ? '#2563eb' : '#94a3b8' }} /></div></td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-medium">{formatCurrency(d.spend)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{d.results}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{cpr > 0 ? <span className={`font-semibold ${isOver ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{formatCurrency(cpr)}</span> : <span className="text-[#c4c4cc]">—</span>}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[#9d9da8]">{formatNumber(d.impressions)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[#9d9da8]">{formatNumber(d.clicks)}</td>
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
            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="p-4">
                <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Segments</p>
                <p className="text-[18px] font-semibold tabular-nums mt-1">{ageGender.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Total Spend</p>
                <p className="text-[18px] font-semibold tabular-nums mt-1">{formatCurrency(audienceTotal.spend)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">{resultLabel}</p>
                <p className="text-[18px] font-semibold tabular-nums mt-1">{formatNumber(audienceTotal.results)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Overall CPR</p>
                <p className={`text-[18px] font-semibold tabular-nums mt-1 ${targetCpl && audienceTotal.results > 0 && (audienceTotal.spend / audienceTotal.results) > targetCpl ? 'text-[#dc2626]' : ''}`}>{audienceTotal.results > 0 ? formatCurrency(audienceTotal.spend / audienceTotal.results) : '—'}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Best Segment</p>
                <p className="text-[13px] font-semibold text-[#16a34a] mt-1">{bestAudienceSegment?.dimension_value || '—'}</p>
                <p className="text-[11px] text-[#9d9da8]">{bestAudienceSegment ? `${formatCurrency(bestAudienceSegment.cpr)} CPR` : ''}</p>
              </Card>
            </div>

            {/* Spend by Segment + Device — 2 col */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className="text-[13px] font-semibold mb-4">Spend by Segment</h3>
                <div className="space-y-2.5">
                  {ageGender.slice(0, 10).map(seg => {
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

              {/* Device Performance — table style */}
              <Card>
                <div className="px-5 py-4 border-b border-[#e8e8ec]">
                  <h3 className="text-[13px] font-semibold">Device Performance</h3>
                </div>
                <DataTable
                  columns={[
                    { key: 'dimension_value', label: 'Device', format: (v) => <span className="font-medium">{v}</span> },
                    { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                    { key: 'results', label: resultLabel, format: (v) => formatNumber(v), align: 'right' },
                    { key: 'cpr', label: 'CPR', format: (v: number) => v > 0 ? <span className={targetCpl && v > targetCpl ? 'text-[#dc2626] font-semibold' : 'text-[#16a34a] font-semibold'}>{formatCurrency(v)}</span> : <span className="text-[#c4c4cc]">—</span>, align: 'right' },
                    { key: '_pct', label: '% Spend', format: (_, row) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
                  ]}
                  data={device}
                  pageSize={20}
                />
              </Card>
            </div>

            {/* Performance Ranking — Best vs Worst */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {topAudienceSegments.length > 0 && (
                <Card className="p-5">
                  <h3 className="text-[13px] font-semibold mb-3">Best Performers</h3>
                  <div className="space-y-2">
                    {topAudienceSegments.map((seg, i) => (
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
                    {worstAudienceSegments.map((seg, i) => {
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

            {/* Full Breakdown Table */}
            <Card>
              <div className="px-5 py-4 border-b border-[#e8e8ec]">
                <h3 className="text-[13px] font-semibold">All Segments</h3>
              </div>
              <DataTable
                columns={[
                  { key: 'dimension_value', label: 'Segment', format: (v) => <span className="font-medium">{v}</span> },
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
                  { key: '_pct', label: '% Spend', format: (_, row) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-[13px] font-semibold">Placements Overview</h3>
                </div>
                <p className="text-[11px] text-[#9d9da8]">{placement.length} active placements</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3 text-[12px]">
                  <div><span className="text-[#9d9da8]">Total Spend</span><p className="font-semibold text-[18px]">{formatCompact(placementTotal.spend)}</p></div>
                  <div><span className="text-[#9d9da8]">Overall CPR</span><p className="font-semibold text-[18px]">{placementTotal.results > 0 ? formatCurrency(placementTotal.spend / placementTotal.results) : '—'}</p></div>
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
                <h3 className="text-[13px] font-semibold mb-3">Spend by Platform</h3>
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
                <h3 className="text-[13px] font-semibold mb-3">Spend Distribution</h3>
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
              <h3 className="text-[13px] font-semibold mb-3">Top Placements</h3>
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
                <h3 className="text-[13px] font-semibold text-[#16a34a] mb-3">Top Performers</h3>
                <div className="space-y-2">
                  {topPlacements.map((p, i) => (
                    <div key={p.dimension_value} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded bg-[#dcfce7] text-[#16a34a] text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-[12px] flex-1 truncate">{p.dimension_value}</span>
                      <span className="text-[12px] font-semibold tabular-nums">{formatCurrency(p.cpr)}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="text-[13px] font-semibold text-[#dc2626] mb-3">Needs Attention</h3>
                <div className="space-y-2">
                  {worstPlacements.map((p, i) => (
                    <div key={p.dimension_value} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded bg-[#fef2f2] text-[#dc2626] text-[10px] font-bold flex items-center justify-center">{placement.length - i}</span>
                      <span className="text-[12px] flex-1 truncate">{p.dimension_value}</span>
                      <span className="text-[12px] font-semibold tabular-nums">{formatCurrency(p.cpr)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* All Placements Table */}
            <Card>
              <div className="px-5 py-4 border-b border-[#e8e8ec]">
                <h3 className="text-[13px] font-semibold">All Placements</h3>
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

        // State abbreviation map
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
        const getAbbr = (name: string) => stateAbbr[name] || name?.slice(0, 2).toUpperCase() || '??'

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
          region.forEach(r => { if (states.some(s => r.dimension_value === s)) { spend += r.spend; impr += r.impressions; clicks += r.clicks; count++ } })
          if (count) regionGroups[rg] = { spend, ctr: impr > 0 ? (clicks / impr) * 100 : 0, count }
        }

        return (
          <TabsContent value="geographic">
            <div className="space-y-5">
              {/* Overview row */}
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

              {/* Top States bar chart */}
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

              {/* All States table */}
              <Card>
                <div className="px-5 py-4 border-b border-[#e8e8ec]">
                  <h3 className="text-[13px] font-semibold">All States</h3>
                </div>
                <DataTable
                  columns={[
                    { key: 'dimension_value', label: 'State', format: (v) => <div className="flex items-center gap-2"><span className="text-[11px] text-[#9d9da8] font-medium w-6">{getAbbr(v)}</span><span className="font-medium">{v}</span></div> },
                    { key: 'spend', label: 'Spend', format: (v) => formatCurrency(v), align: 'right' },
                    { key: 'impressions', label: 'Impressions', format: (v) => formatNumber(v), align: 'right' },
                    { key: 'clicks', label: 'Clicks', format: (v) => formatNumber(v), align: 'right' },
                    { key: 'ctr', label: 'CTR', format: (v: number) => formatPercent(v), align: 'right' },
                    { key: '_pct', label: '% of Spend', format: (_, row) => <span className="text-[#9d9da8]">{totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : '—'}</span>, align: 'right' },
                  ]}
                  data={region}
                />
              </Card>
            </div>
          </TabsContent>
        )
      })()}
      {/* ═══════════════════ SETTINGS ═══════════════════ */}
      {!portalMode && clientId && (
        <TabsContent value="creative-analysis">
          <CreativeAnalysis clientId={clientId} />
        </TabsContent>
      )}

      {!portalMode && <TabsContent value="settings">
        <div className="space-y-5 max-w-2xl">
          <Card className="p-5">
            <h3 className="text-[13px] font-semibold mb-4">Account Configuration</h3>
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
            <h3 className="text-[13px] font-semibold mb-4">Client Portal</h3>
            <p className="text-[12px] text-[#9d9da8] mb-3">Generate a shareable link for your client to view their dashboard — no login required.</p>
            <div className="space-y-3">
              {portalToken ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${portalToken}`}
                      className="flex-1 px-3 py-2 border border-[#e8e8ec] rounded text-[12px] text-[#111113] bg-[#f8f8fa] font-mono"
                    />
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal/${portalToken}`); }}
                      className="px-3 py-2 rounded border border-[#e8e8ec] text-[12px] font-medium text-[#111113] hover:bg-[#f8f8fa]"
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('This will invalidate the current link. Continue?')) return
                      setPortalLoading(true)
                      const res = await fetch('/api/portal', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }) })
                      if (res.ok) setPortalToken(null)
                      setPortalLoading(false)
                    }}
                    className="text-[11px] text-[#dc2626] hover:underline"
                  >
                    Revoke link
                  </button>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setPortalLoading(true)
                    const res = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }) })
                    const data = await res.json()
                    if (data.token) setPortalToken(data.token)
                    setPortalLoading(false)
                  }}
                  disabled={portalLoading}
                  className="px-4 py-2 rounded bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  {portalLoading ? 'Generating...' : 'Generate Portal Link'}
                </button>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[13px] font-semibold mb-4">Data Summary</h3>
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
      </TabsContent>}
    </Tabs>
    <AdDetailModal
      ad={selectedAd}
      open={!!selectedAd}
      onClose={() => setSelectedAd(null)}
      resultLabel={resultLabel}
      targetCpl={targetCpl}
      onPrev={selectedAd ? (() => {
        const list = filteredAds.length > 0 ? filteredAds : ads
        const idx = list.findIndex(a => a.platform_ad_id === selectedAd.platform_ad_id)
        if (idx > 0) setSelectedAd(list[idx - 1])
      }) : undefined}
      onNext={selectedAd ? (() => {
        const list = filteredAds.length > 0 ? filteredAds : ads
        const idx = list.findIndex(a => a.platform_ad_id === selectedAd.platform_ad_id)
        if (idx < list.length - 1) setSelectedAd(list[idx + 1])
      }) : undefined}
    />
    </>
  )
}
