import { getClientBySlug, getClientInsights, getCampaignBreakdown, getAdBreakdown, getBreakdownData } from '@/lib/queries'
import { formatCurrency, formatNumber, formatPercent, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Badge } from '@/components/ui/badge'
import { notFound } from 'next/navigation'
import { ClientTabs } from './client-tabs'

export const revalidate = 300

export default async function ClientDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let client
  try { client = await getClientBySlug(slug) } catch { notFound() }
  if (!client) notFound()

  const activeAccount = (client.ad_accounts as any[])?.find((a: any) => a.is_active)
  if (!activeAccount) return (
    <><Nav current="clients" /><PageWrapper><div className="p-8 text-zinc-500">No active ad account</div></PageWrapper></>
  )

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

  const cprOnTarget = activeAccount.target_cpl ? cpr <= activeAccount.target_cpl : undefined
  const roasOnTarget = activeAccount.target_roas ? roas >= activeAccount.target_roas : undefined

  // Top/bottom ads
  const adsWithSpend = ads.filter(a => a.spend > 0 && a.results > 0)
  const topAds = [...adsWithSpend].sort((a, b) => a.cpr - b.cpr).slice(0, 5)
  const bottomAds = [...adsWithSpend].sort((a, b) => b.cpr - a.cpr).slice(0, 5)

  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-8 max-w-[1400px] mx-auto">
          {/* Breadcrumb */}
          <div className="text-[12px] text-zinc-500 mb-3 flex items-center gap-1.5">
            <a href="/" className="hover:text-white transition-colors">Dashboard</a>
            <span className="text-zinc-700">/</span>
            <a href="/clients" className="hover:text-white transition-colors">Clients</a>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-300">{client.name}</span>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-white">{client.name}</h1>
              <p className="text-sm text-zinc-500 mt-1">{ads.length} ads — last {days} days</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">Active</Badge>
              <span className="text-[12px] text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">Last {days} days</span>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {isEcom ? (
              <>
                <KpiCard label="ROAS" value={`${roas.toFixed(2)}x`} target={activeAccount.target_roas ? `Target: ${activeAccount.target_roas}x` : undefined} status={roasOnTarget} />
                <KpiCard label="Total Spend" value={formatCurrency(totals.spend)} sub={`${formatCurrency(totals.spend / days)} / day`} />
                <KpiCard label={`Total ${resultLabel}`} value={formatNumber(totals.results)} sub={`${(totals.results / days).toFixed(1)} / day`} />
                <KpiCard label="CTR" value={formatPercent(ctr)} sub={ctr > 3 ? 'Above average' : ctr > 2 ? 'Average' : 'Below average'} />
              </>
            ) : (
              <>
                <KpiCard label={`Cost Per ${resultLabel.replace(/s$/, '')}`} value={cpr > 0 ? formatCurrency(cpr) : '—'} target={activeAccount.target_cpl ? `Target: ${formatCurrency(activeAccount.target_cpl)}` : undefined} status={cprOnTarget} />
                <KpiCard label="Total Spend" value={formatCurrency(totals.spend)} sub={`${formatCurrency(totals.spend / days)} / day`} />
                <KpiCard label={`Total ${resultLabel}`} value={formatNumber(totals.results)} sub={`${(totals.results / days).toFixed(1)} / day`} />
                <KpiCard label="CTR" value={formatPercent(ctr)} sub={ctr > 3 ? 'Above average' : ctr > 2 ? 'Average' : 'Below average'} />
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

function KpiCard({ label, value, target, sub, status }: {
  label: string; value: string; target?: string; sub?: string; status?: boolean
}) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{label}</span>
        {status !== undefined && (
          <Badge variant={status ? 'success' : 'danger'}>{status ? 'On Target' : 'Over'}</Badge>
        )}
      </div>
      <p className="text-[28px] font-semibold tabular-nums text-white tracking-tight">{value}</p>
      {target && <p className="text-[12px] text-zinc-500 mt-1">{target}</p>}
      {sub && <p className="text-[12px] text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}
