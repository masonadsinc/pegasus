import { getClientBySlug, getClientInsights, getCampaignBreakdown, getAdBreakdown, getBreakdownData } from '@/lib/queries'
import { formatCurrency, formatNumber, formatPercent, cplStatusTier, roasStatusTier, statusConfig, isEcomActionType, grade, roasGrade, wowChange, wowChangeCPL } from '@/lib/utils'
import { Nav } from '@/components/nav'
import { MetricCard } from '@/components/metric-card'
import { notFound } from 'next/navigation'
import { ClientTabs } from './client-tabs'

export const revalidate = 300

export default async function ClientDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let client
  try {
    client = await getClientBySlug(slug)
  } catch { notFound() }
  if (!client) notFound()

  const activeAccount = (client.ad_accounts as any[])?.find((a: any) => a.is_active)
  if (!activeAccount) return <div className="p-8 text-zinc-500">No active ad account</div>

  const pat = activeAccount.primary_action_type
  const isEcom = isEcomActionType(pat)
  const days = 30

  // Fetch all data in parallel
  const [daily, campaigns, ads, ageGender, placement, device, region] = await Promise.all([
    getClientInsights(activeAccount.id, days, pat),
    getCampaignBreakdown(activeAccount.id, days, pat),
    getAdBreakdown(activeAccount.id, days, pat),
    getBreakdownData(activeAccount.id, 'age_gender', days, pat),
    getBreakdownData(activeAccount.id, 'placement', days, pat),
    getBreakdownData(activeAccount.id, 'device', days, pat),
    getBreakdownData(activeAccount.id, 'region', days, pat),
  ])

  // Aggregate totals
  const totals = daily.reduce((acc, d) => ({
    spend: acc.spend + d.spend,
    impressions: acc.impressions + d.impressions,
    clicks: acc.clicks + d.clicks,
    results: acc.results + d.results,
    purchase_value: acc.purchase_value + d.purchase_value,
    landing_page_views: acc.landing_page_views + d.landing_page_views,
  }), { spend: 0, impressions: 0, clicks: 0, results: 0, purchase_value: 0, landing_page_views: 0 })

  // WoW: split daily into this week vs last week (last 7 vs 7 before that)
  const thisWeek = daily.slice(-7)
  const lastWeek = daily.slice(-14, -7)
  const twTotals = thisWeek.reduce((a, d) => ({ spend: a.spend + d.spend, results: a.results + d.results, pv: a.pv + d.purchase_value }), { spend: 0, results: 0, pv: 0 })
  const lwTotals = lastWeek.reduce((a, d) => ({ spend: a.spend + d.spend, results: a.results + d.results, pv: a.pv + d.purchase_value }), { spend: 0, results: 0, pv: 0 })

  const cpr = totals.results > 0 ? totals.spend / totals.results : 0
  const roas = totals.spend > 0 ? totals.purchase_value / totals.spend : 0
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const twCpr = twTotals.results > 0 ? twTotals.spend / twTotals.results : 0
  const lwCpr = lwTotals.results > 0 ? lwTotals.spend / lwTotals.results : 0
  const twRoas = twTotals.spend > 0 ? twTotals.pv / twTotals.spend : 0
  const lwRoas = lwTotals.spend > 0 ? lwTotals.pv / lwTotals.spend : 0

  const resultLabel = pat === 'schedule_total' ? 'Schedules' : pat?.includes('fb_pixel_custom') ? 'Calls' : isEcom ? 'Purchases' : 'Leads'

  // Status
  const status = isEcom
    ? roasStatusTier(roas, activeAccount.target_roas)
    : cplStatusTier(cpr, activeAccount.target_cpl)
  const config = statusConfig[status]

  // Top/bottom ads
  const adsWithSpend = ads.filter(a => a.spend > 0 && a.results > 0)
  const topAds = [...adsWithSpend].sort((a, b) => a.cpr - b.cpr).slice(0, 3)
  const bottomAds = [...adsWithSpend].sort((a, b) => b.cpr - a.cpr).slice(0, 3)

  // Funnel
  const funnelSteps = [
    { label: 'Impressions', value: totals.impressions },
    { label: 'Clicks', value: totals.clicks, rate: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0 },
    { label: 'LPV', value: totals.landing_page_views, rate: totals.clicks > 0 ? (totals.landing_page_views / totals.clicks) * 100 : 0 },
    { label: resultLabel, value: totals.results, rate: totals.landing_page_views > 0 ? (totals.results / totals.landing_page_views) * 100 : (totals.clicks > 0 ? (totals.results / totals.clicks) * 100 : 0) },
  ]

  return (
    <main className="min-h-screen pb-8">
      <Nav current="clients" />

      <div className="max-w-6xl mx-auto px-4 mt-4">
        {/* Breadcrumb + Header */}
        <div className="text-xs text-zinc-500 mb-2">
          <a href="/" className="hover:text-zinc-300">Dashboard</a>
          <span className="mx-1">/</span>
          <a href="/clients" className="hover:text-zinc-300">Clients</a>
          <span className="mx-1">/</span>
          <span className="text-zinc-300">{client.name}</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <span className={`w-3 h-3 rounded-full ${config.dot}`} />
          <div>
            <h1 className="text-xl font-bold">{client.name}</h1>
            <p className="text-sm text-zinc-500">
              {(client.ad_accounts as any[])?.length} ad account{(client.ad_accounts as any[])?.length !== 1 ? 's' : ''} · Last {days} days
              {client.industry && ` · ${client.industry}`}
            </p>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {isEcom ? (
            <>
              <MetricCard
                label="ROAS"
                value={`${roas.toFixed(1)}x`}
                subtext={activeAccount.target_roas ? `${activeAccount.target_roas}x target` : undefined}
                change={wowChange(twRoas, lwRoas)}
              />
              <MetricCard label="Spend" value={formatCurrency(totals.spend)} subtext={`${formatCurrency(totals.spend / days)}/day`} change={wowChange(twTotals.spend, lwTotals.spend)} />
              <MetricCard label="Revenue" value={formatCurrency(totals.purchase_value)} change={wowChange(twTotals.pv, lwTotals.pv)} />
              <MetricCard label="CTR" value={formatPercent(ctr)} />
            </>
          ) : (
            <>
              <MetricCard
                label={`Cost per ${resultLabel.toLowerCase().replace(/s$/, '')}`}
                value={cpr > 0 ? formatCurrency(cpr) : '—'}
                subtext={activeAccount.target_cpl ? `${formatCurrency(activeAccount.target_cpl)} target` : undefined}
                change={wowChangeCPL(twCpr, lwCpr)}
              />
              <MetricCard label="Spend" value={formatCurrency(totals.spend)} subtext={`${formatCurrency(totals.spend / days)}/day`} change={wowChange(twTotals.spend, lwTotals.spend)} />
              <MetricCard label={resultLabel} value={formatNumber(totals.results)} subtext={`${(totals.results / days).toFixed(1)}/day`} change={wowChange(twTotals.results, lwTotals.results)} />
              <MetricCard label="CTR" value={formatPercent(ctr)} />
            </>
          )}
        </div>

        {/* Tabs */}
        <ClientTabs
          daily={daily}
          campaigns={campaigns}
          ads={ads}
          topAds={topAds}
          bottomAds={bottomAds}
          funnelSteps={funnelSteps}
          ageGender={ageGender}
          placement={placement}
          device={device}
          region={region}
          resultLabel={resultLabel}
          isEcom={isEcom}
          targetCpl={activeAccount.target_cpl}
          targetRoas={activeAccount.target_roas}
        />
      </div>
    </main>
  )
}
