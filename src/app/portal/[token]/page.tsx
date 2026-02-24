import { getClientInsights, getCampaignBreakdown, getAdSetBreakdown, getAdBreakdown, getBreakdownData } from '@/lib/queries'
import { formatCurrency, formatNumber, formatPercent, isEcomActionType } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { PortalTabs } from './portal-tabs'
import { PortalDatePicker } from './portal-date-picker'

export const revalidate = 0

const ORG_ID = process.env.ADSINC_ORG_ID!
const VALID_DAYS = [7, 14, 30, 60, 90]

function KpiCard({ label, value, target, sub, status, progressPct }: {
  label: string; value: string; target?: string; sub?: string; status?: boolean; progressPct?: number
}) {
  return (
    <div className={`rounded-md bg-white border border-[#e8e8ec] p-5 relative overflow-hidden ${
      status === true ? 'border-l-[3px] border-l-[#16a34a]' :
      status === false ? 'border-l-[3px] border-l-[#dc2626]' : ''
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider">{label}</span>
        {status !== undefined && (
          <Badge variant={status ? 'success' : 'danger'}>{status ? 'On Target' : 'Over'}</Badge>
        )}
      </div>
      <p className="text-[24px] font-semibold tabular-nums text-[#111113] tracking-tight">{value}</p>
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

export default async function PortalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ days?: string }> }) {
  const { token } = await params
  const sp = await searchParams
  const rawDays = parseInt(sp.days || '30', 10)
  const days = VALID_DAYS.includes(rawDays) ? rawDays : 30

  // Look up client by portal token
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug, industry, status, portal_token, ad_accounts(id, name, platform_account_id, objective, primary_action_type, target_cpl, target_roas, is_active, last_synced_at)')
    .eq('portal_token', token)
    .eq('org_id', ORG_ID)
    .single()

  if (!client) notFound()

  const activeAccount = (client.ad_accounts as any[])?.find((a: any) => a.is_active)
  if (!activeAccount) notFound()

  const pat = activeAccount.primary_action_type
  const isEcom = isEcomActionType(pat)

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
    <div className="min-h-screen bg-[#fafafa]">
      {/* Portal header */}
      <div className="bg-white border-b border-[#e8e8ec]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[20px] font-semibold text-[#111113]">{client.name}</h1>
            <Badge variant="success">Active</Badge>
          </div>
          <div className="flex items-center gap-3">
            <PortalDatePicker currentDays={days} />
            {activeAccount.last_synced_at && (
              <p className="text-[10px] text-[#9d9da8] hidden sm:block">
                Synced {new Date(activeAccount.last_synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {isEcom ? (
            <>
              <KpiCard label="ROAS" value={`${roas.toFixed(2)}x`} target={activeAccount.target_roas ? `Target: ${activeAccount.target_roas}x` : undefined} status={roasOnTarget} />
              <KpiCard label="Total Spend" value={formatCurrency(totals.spend)} sub={`Last ${days} days`} />
              <KpiCard label={`Total ${resultLabel}`} value={formatNumber(totals.results)} sub={`~${(totals.results / days).toFixed(1)}/day avg`} />
              <KpiCard label="Click Rate" value={formatPercent(ctr)} />
            </>
          ) : (
            <>
              <KpiCard label={`Cost Per ${resultLabel.replace(/s$/, '')}`} value={cpr > 0 ? formatCurrency(cpr) : '—'} target={activeAccount.target_cpl ? `Target: ${formatCurrency(activeAccount.target_cpl)}` : undefined} status={cprOnTarget} progressPct={cplProgressPct} />
              <KpiCard label="Total Spend" value={formatCurrency(totals.spend)} sub={`Last ${days} days`} />
              <KpiCard label={`Total ${resultLabel}`} value={formatNumber(totals.results)} sub={`~${(totals.results / days).toFixed(1)}/day avg`} />
              <KpiCard label="Click Rate" value={formatPercent(ctr)} />
            </>
          )}
        </div>

        {/* Tabs — same as client page minus Creative Studio and Settings */}
        <PortalTabs
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

        {/* Footer */}
        <div className="text-center py-6 mt-6">
          <p className="text-[10px] text-[#9d9da8]">Powered by Ads.Inc</p>
        </div>
      </div>
    </div>
  )
}
