import { getDashboardData } from '@/lib/queries'
import { formatCurrency, formatNumber, cplStatus, roasStatus, statusDot, isEcomActionType } from '@/lib/utils'
import { Nav } from '@/components/nav'

const ORG_ID = process.env.ADSINC_ORG_ID!

export const revalidate = 300

function KpiCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
      {subtext && <p className="text-xs text-zinc-500 mt-0.5">{subtext}</p>}
    </div>
  )
}

function StatusIndicator({ status }: { status: 'green' | 'yellow' | 'red' }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${statusDot(status)}`} />
}

function AccountRow({ account }: { account: any }) {
  const isEcom = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'].includes(account.primary_action_type || '')
  const cpr = account.results > 0 ? account.spend / account.results : 0
  const roas = account.spend > 0 ? account.purchase_value / account.spend : 0
  
  let status: 'green' | 'yellow' | 'red' = 'green'
  if (isEcom && account.target_roas) {
    status = roasStatus(roas, account.target_roas)
  } else if (account.target_cpl) {
    status = cplStatus(cpr, account.target_cpl)
  }

  const primaryMetric = isEcom
    ? `${roas.toFixed(1)}x`
    : cpr > 0 ? formatCurrency(cpr) : '—'
  
  const target = isEcom
    ? account.target_roas ? `${account.target_roas}x` : '—'
    : account.target_cpl ? formatCurrency(account.target_cpl) : '—'

  return (
    <a href={`/clients/${account.client_slug}`} className="flex items-center gap-3 py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-zinc-800 transition-colors">
      <StatusIndicator status={status} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{account.client_name}</p>
        <p className="text-xs text-zinc-500">{formatNumber(account.results)} {account.result_label} · {formatNumber(account.impressions)} imps</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold">{formatCurrency(account.spend)}</p>
        <p className="text-xs text-zinc-500">{primaryMetric} <span className="text-zinc-600">/ {target}</span></p>
      </div>
    </a>
  )
}

export default async function Dashboard() {
  const accounts = await getDashboardData(ORG_ID, 7)

  const totalSpend = accounts.reduce((s, a) => s + a.spend, 0)
  const totalResults = accounts.reduce((s, a) => s + a.results, 0)
  const totalPurchases = accounts.reduce((s, a) => s + a.purchases, 0)
  const totalImpressions = accounts.reduce((s, a) => s + a.impressions, 0)
  const totalPurchaseValue = accounts.reduce((s, a) => s + a.purchase_value, 0)
  
  const isEcomAccount = (a: any) => ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'].includes(a.primary_action_type || '')
  const nonEcomAccounts = accounts.filter(a => !isEcomAccount(a))
  const totalNonEcomSpend = nonEcomAccounts.reduce((s, a) => s + a.spend, 0)
  const totalNonEcomResults = nonEcomAccounts.reduce((s, a) => s + a.results, 0)
  const blendedCPR = totalNonEcomResults > 0 ? totalNonEcomSpend / totalNonEcomResults : 0

  const activeAccounts = accounts.filter(a => a.spend > 0)
  const redAccounts = activeAccounts.filter(a => {
    const cpr = a.results > 0 ? a.spend / a.results : 999
    if (isEcomAccount(a)) return a.target_roas ? (a.purchase_value / a.spend) < a.target_roas * 0.7 : false
    return a.target_cpl ? cpr > a.target_cpl * 1.3 : false
  })
  const yellowAccounts = activeAccounts.filter(a => {
    const cpr = a.results > 0 ? a.spend / a.results : 0
    if (isEcomAccount(a)) {
      const r = a.spend > 0 ? a.purchase_value / a.spend : 0
      return a.target_roas ? r < a.target_roas && r >= a.target_roas * 0.7 : false
    }
    return a.target_cpl ? cpr > a.target_cpl && cpr <= a.target_cpl * 1.3 : false
  })

  return (
    <main className="min-h-screen pb-8">
      <Nav current="dashboard" />
      <div className="px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div />
          <div className="flex items-center gap-2 text-xs">
            {redAccounts.length > 0 && <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{redAccounts.length} red</span>}
            {yellowAccounts.length > 0 && <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{yellowAccounts.length} yellow</span>}
            <span className="text-zinc-500">7d</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* KPI Grid - 2x2 on mobile */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <KpiCard label="Spend" value={formatCurrency(totalSpend)} subtext={`${formatCurrency(totalSpend / 7)}/day`} />
          <KpiCard label="Results" value={formatNumber(totalResults)} subtext={`${(totalResults / 7).toFixed(0)}/day`} />
          <KpiCard label="Blended CPR" value={blendedCPR > 0 ? formatCurrency(blendedCPR) : '—'} />
          <KpiCard label="Purchases" value={formatNumber(totalPurchases)} subtext={totalPurchaseValue > 0 ? formatCurrency(totalPurchaseValue) : undefined} />
        </div>

        {/* Attention Queue */}
        {redAccounts.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-red-400 mb-2 px-1">⚠️ Needs Attention</h2>
            <div className="space-y-2">
              {redAccounts.map(a => (
                <AccountRow key={a.ad_account_id} account={a} />
              ))}
            </div>
          </div>
        )}

        {/* All Active Accounts */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-400 mb-2 px-1">Active ({activeAccounts.length})</h2>
          <div className="space-y-2">
            {activeAccounts.map(a => (
              <AccountRow key={a.ad_account_id} account={a} />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
