import { getClientBySlug, getClientInsights, getCampaignBreakdown, getAdBreakdown, getBreakdownData } from '@/lib/queries'
import { formatCurrency, formatNumber, formatPercent, cplStatusTier, roasStatusTier, isEcomActionType, wowChange, wowChangeCPL } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Badge } from '@/components/ui/badge'
import { notFound } from 'next/navigation'
import { ClientTabs } from './client-tabs'

export const revalidate = 300

function KpiCard({ label, value, subtitle, icon, statusColor, progressPct }: {
  label: string; value: string; subtitle?: string; icon?: string; statusColor?: string; progressPct?: number
}) {
  return (
    <div className="rounded-2xl bg-white border border-[#e5e5e5] p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-[#86868b] uppercase tracking-wider font-medium">{label}</span>
        {statusColor && (
          <Badge variant={statusColor === 'green' ? 'onTarget' : statusColor === 'red' ? 'attention' : 'warning'}>
            {statusColor === 'green' ? 'On Target' : statusColor === 'red' ? 'Over' : 'Watch'}
          </Badge>
        )}
      </div>
      <p className="text-[28px] font-bold tracking-tight tabular-nums">{value}</p>
      {subtitle && <p className="text-[12px] text-[#86868b] mt-0.5">{subtitle}</p>}
      {progressPct !== undefined && (
        <div className="mt-3 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(progressPct, 100)}%`,
              backgroundColor: progressPct <= 100 ? '#34c759' : progressPct <= 125 ? '#ff9500' : '#ff3b30'
            }}
          />
        </div>
      )}
    </div>
  )
}

export default async function ClientDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let client
  try { client = await getClientBySlug(slug) } catch { notFound() }
  if (!client) notFound()

  const activeAccount = (client.ad_accounts as any[])?.find((a: any) => a.is_active)
  if (!activeAccount) return <div className="p-8 text-[#86868b]">No active ad account</div>

  const pat = activeAccount.primary_action_type
  const isEcom = isEcomActionType(pat)
  const days = 30

  const [daily, campaigns, ads, ageGender, placement, device, region] = await Promise.all([
    getClientInsights(activeAccount.id, days, pat),
    getCampaignBreakdown(activeAccount.id, days, pat),
    getAdBreakdown(activeAccount.id, days, pat),
    getBreakdownData(activeAccount.id, 'age_gender', days, pat),
    getBreakdownData(activeAccount.id, 'placement', days, pat),
    getBreakdownData(activeAccount.id, 'device', days, pat),
    getBreakdownData(activeAccount.id, 'region', days, pat),
  ])

  const totals = daily.reduce((acc, d) => ({
    spend: acc.spend + d.spend, impressions: acc.impressions + d.impressions,
    clicks: acc.clicks + d.clicks, results: acc.results + d.results,
    purchase_value: acc.purchase_value + d.purchase_value, landing_page_views: acc.landing_page_views + d.landing_page_views,
  }), { spend: 0, impressions: 0, clicks: 0, results: 0, purchase_value: 0, landing_page_views: 0 })

  const cpr = totals.results > 0 ? totals.spend / totals.results : 0
  const roas = totals.spend > 0 ? totals.purchase_value / totals.spend : 0
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const resultLabel = pat === 'schedule_total' ? 'Schedules' : pat?.includes('fb_pixel_custom') ? 'Calls' : isEcom ? 'Purchases' : 'Leads'

  // CPL progress: 0% = free, 100% = at target, >100% = over
  const cplProgressPct = activeAccount.target_cpl && cpr > 0 ? (cpr / activeAccount.target_cpl) * 100 : undefined
  const cplStatusColor = cplProgressPct ? (cplProgressPct <= 100 ? 'green' : cplProgressPct <= 125 ? 'orange' : 'red') : undefined

  // WoW
  const thisWeek = daily.slice(-7)
  const lastWeek = daily.slice(-14, -7)
  const tw = thisWeek.reduce((a, d) => ({ spend: a.spend + d.spend, results: a.results + d.results }), { spend: 0, results: 0 })
  const lw = lastWeek.reduce((a, d) => ({ spend: a.spend + d.spend, results: a.results + d.results }), { spend: 0, results: 0 })

  // Top/bottom ads
  const adsWithSpend = ads.filter(a => a.spend > 0 && a.results > 0)
  const topAds = [...adsWithSpend].sort((a, b) => a.cpr - b.cpr).slice(0, 3)
  const bottomAds = [...adsWithSpend].sort((a, b) => b.cpr - a.cpr).slice(0, 3)

  // Funnel
  const funnelSteps = [
    { label: 'Impressions', value: totals.impressions, icon: '👁️' },
    { label: 'Clicks', value: totals.clicks, rate: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0, rateLabel: 'CTR' },
    { label: resultLabel, value: totals.results, rate: totals.clicks > 0 ? (totals.results / totals.clicks) * 100 : 0, rateLabel: 'Conv Rate' },
  ]

  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-6 max-w-[1200px] mx-auto">
          {/* Breadcrumb */}
          <div className="text-[12px] text-[#86868b] mb-2">
            <a href="/" className="hover:text-[#1d1d1f]">Dashboard</a>
            <span className="mx-1.5">/</span>
            <a href="/clients" className="hover:text-[#1d1d1f]">Clients</a>
            <span className="mx-1.5">/</span>
            <span className="text-[#1d1d1f]">{client.name}</span>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-[#1d1d1f]">{client.name}</h1>
              <p className="text-[13px] text-[#86868b]">{ads.length} active ads</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="onTarget">Active</Badge>
              <span className="text-[12px] text-[#86868b] bg-white border border-[#e5e5e5] rounded-lg px-3 py-1.5">📅 Last {days} days</span>
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {isEcom ? (
              <>
                <KpiCard label="ROAS" value={`${roas.toFixed(2)}x`} subtitle={activeAccount.target_roas ? `Target: ${activeAccount.target_roas}x` : undefined} statusColor={roas >= (activeAccount.target_roas || 0) ? 'green' : 'red'} />
                <KpiCard label="Total Spend" value={formatCurrency(totals.spend)} subtitle={`Last ${days} days`} />
                <KpiCard label={`Total ${resultLabel}`} value={formatNumber(totals.results)} subtitle={`~${(totals.results / days).toFixed(1)}/day avg`} />
                <KpiCard label="Click Rate" value={formatPercent(ctr)} subtitle={ctr > 3 ? 'Excellent' : ctr > 2 ? 'Good' : 'Below avg'} />
              </>
            ) : (
              <>
                <KpiCard
                  label={`Cost Per ${resultLabel.replace(/s$/, '')}`}
                  value={cpr > 0 ? formatCurrency(cpr) : '—'}
                  subtitle={activeAccount.target_cpl ? `🎯 Target: ${formatCurrency(activeAccount.target_cpl)}` : undefined}
                  statusColor={cplStatusColor}
                  progressPct={cplProgressPct}
                />
                <KpiCard label="Total Spend" value={formatCurrency(totals.spend)} subtitle={`Last ${days} days`} />
                <KpiCard label={`Total ${resultLabel}`} value={formatNumber(totals.results)} subtitle={`~${(totals.results / days).toFixed(1)}/day avg`} />
                <KpiCard label="Click Rate" value={formatPercent(ctr)} subtitle={ctr > 3 ? 'Excellent' : ctr > 2 ? 'Good' : 'Below avg'} />
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
            totalSpend={totals.spend}
          />
        </div>
      </PageWrapper>
    </>
  )
}
