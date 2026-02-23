import { getClientBySlug, getClientInsights, getCampaignBreakdown, getAdSetBreakdown, getAdBreakdown, getBreakdownData } from '@/lib/queries'
import { formatCurrency, formatNumber, formatPercent, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Badge } from '@/components/ui/badge'
import { DateRangePicker } from '@/components/date-range-picker'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ClientTabs } from './client-tabs'

export const revalidate = 300

function KpiCard({ label, value, target, sub, status, icon, progressPct }: {
  label: string; value: string; target?: string; sub?: string; status?: boolean; icon?: string; progressPct?: number
}) {
  return (
    <div className="rounded-xl bg-white border border-[#e8e8ec] p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon && <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
            status === true ? 'bg-[#dcfce7] text-[#16a34a]' :
            status === false ? 'bg-[#fef2f2] text-[#dc2626]' :
            'bg-[#eff6ff] text-[#2563eb]'
          }`}>{icon}</span>}
          <span className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider">{label}</span>
        </div>
        {status !== undefined && (
          <Badge variant={status ? 'success' : 'danger'}>{status ? 'On Target' : 'Over'}</Badge>
        )}
      </div>
      <p className="text-[28px] font-bold tabular-nums text-[#111113] tracking-tight">{value}</p>
      {target && <p className="text-[12px] text-[#9d9da8] mt-0.5">{target}</p>}
      {sub && <p className="text-[12px] text-[#9d9da8] mt-0.5">{sub}</p>}
      {progressPct !== undefined && (
        <div className="mt-3 h-1.5 bg-[#f4f4f6] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{
            width: `${Math.min(progressPct, 100)}%`,
            backgroundColor: progressPct <= 100 ? '#16a34a' : progressPct <= 125 ? '#ea580c' : '#dc2626'
          }} />
        </div>
      )}
    </div>
  )
}

export default async function ClientDetailPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ days?: string }> }) {
  const { slug } = await params
  const sp = await searchParams
  let client
  try { client = await getClientBySlug(slug) } catch { notFound() }
  if (!client) notFound()

  const activeAccount = (client.ad_accounts as any[])?.find((a: any) => a.is_active)
  if (!activeAccount) return (
    <><Nav current="clients" /><PageWrapper><div className="p-8 text-[#9d9da8]">No active ad account</div></PageWrapper></>
  )

  const pat = activeAccount.primary_action_type
  const isEcom = isEcomActionType(pat)
  const days = [7, 14, 30, 60, 90].includes(Number(sp.days)) ? Number(sp.days) : 30

  const [daily, campaigns, adSets, ads, ageGender, placement, device, region] = await Promise.all([
    getClientInsights(activeAccount.id, days, pat),
    getCampaignBreakdown(activeAccount.id, days, pat),
    getAdSetBreakdown(activeAccount.id, days, pat),
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
  const cplProgressPct = activeAccount.target_cpl && cpr > 0 ? (cpr / activeAccount.target_cpl) * 100 : undefined

  const adsWithSpend = ads.filter(a => a.spend > 0 && a.results > 0)
  const topAds = [...adsWithSpend].sort((a, b) => a.cpr - b.cpr).slice(0, 3)
  const bottomAds = [...adsWithSpend].sort((a, b) => b.cpr - a.cpr).slice(0, 3)

  const funnelSteps = [
    { label: 'Impressions', value: totals.impressions },
    { label: 'Clicks', value: totals.clicks, rate: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0, rateLabel: 'CTR' },
    { label: resultLabel, value: totals.results, rate: totals.clicks > 0 ? (totals.results / totals.clicks) * 100 : 0, rateLabel: 'Conv Rate' },
  ]

  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-6 max-w-[1200px] mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] text-[#9d9da8]">
              <a href="/" className="hover:text-[#111113]">Dashboard</a>
              <span className="mx-1.5">/</span>
              <a href="/clients" className="hover:text-[#111113]">Clients</a>
              <span className="mx-1.5">/</span>
              <span className="text-[#111113]">{client.name}</span>
            </div>
            {activeAccount.last_synced_at && (
              <span className="text-[11px] text-[#9d9da8]">
                Last synced: {new Date(activeAccount.last_synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            )}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xl font-bold text-[#111113]">{client.name}</h1>
            <div className="flex items-center gap-3">
              <Badge variant="success">Active</Badge>
              <Suspense fallback={<span className="text-[12px] text-[#9d9da8] bg-white border border-[#e8e8ec] rounded-lg px-3 py-1.5">Last {days} days</span>}>
                <DateRangePicker />
              </Suspense>
              <a
                href={`/api/export?account_id=${activeAccount.id}&type=ads&days=${days}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#6b6b76] bg-white border border-[#e8e8ec] rounded-lg hover:bg-[#f4f4f6] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" /></svg>
                Export
              </a>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {isEcom ? (
              <>
                <KpiCard label="ROAS" value={`${roas.toFixed(2)}x`} target={activeAccount.target_roas ? `Target: ${activeAccount.target_roas}x` : undefined} status={roasOnTarget} icon="$" />
                <KpiCard label="Total Spend" value={formatCurrency(totals.spend)} sub={`Last ${days} days`} icon="$" />
                <KpiCard label={`Total ${resultLabel}`} value={formatNumber(totals.results)} sub={`~${(totals.results / days).toFixed(1)}/day avg`} icon="#" />
                <KpiCard label="Click Rate" value={formatPercent(ctr)} sub={ctr > 3 ? 'Excellent' : ctr > 2 ? 'Average' : 'Below average'} icon="%" />
              </>
            ) : (
              <>
                <KpiCard label={`Cost Per ${resultLabel.replace(/s$/, '')}`} value={cpr > 0 ? formatCurrency(cpr) : '—'} target={activeAccount.target_cpl ? `Target: ${formatCurrency(activeAccount.target_cpl)}` : undefined} status={cprOnTarget} icon="$" progressPct={cplProgressPct} />
                <KpiCard label="Total Spend" value={formatCurrency(totals.spend)} sub={`Last ${days} days`} icon="$" />
                <KpiCard label={`Total ${resultLabel}`} value={formatNumber(totals.results)} sub={`~${(totals.results / days).toFixed(1)}/day avg`} icon="#" />
                <KpiCard label="Click Rate" value={formatPercent(ctr)} sub={ctr > 3 ? 'Excellent' : ctr > 2 ? 'Average' : 'Below average'} icon="%" />
              </>
            )}
          </div>

          {/* Tabs */}
          <ClientTabs
            daily={daily}
            campaigns={campaigns}
            adSets={adSets}
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
            clientName={client.name}
            accountName={activeAccount.name}
            platformAccountId={activeAccount.platform_account_id}
            objective={activeAccount.objective}
            primaryActionType={pat}
          />
        </div>
      </PageWrapper>
    </>
  )
}
