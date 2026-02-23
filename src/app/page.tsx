import { getDashboardData } from '@/lib/queries'
import { formatCurrency, formatNumber, cplStatus, roasStatus, statusDot } from '@/lib/utils'

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
  const cpl = account.leads > 0 ? account.spend / account.leads : 0
  const roas = account.spend > 0 ? account.purchase_value / account.spend : 0
  const isEcom = account.objective === 'purchases'
  
  let status: 'green' | 'yellow' | 'red' = 'green'
  if (isEcom && account.target_roas) {
    status = roasStatus(roas, account.target_roas)
  } else if (account.target_cpl) {
    status = cplStatus(cpl, account.target_cpl)
  }

  const primaryMetric = isEcom
    ? `${roas.toFixed(1)}x`
    : cpl > 0 ? formatCurrency(cpl) : '—'
  
  const target = isEcom
    ? account.target_roas ? `${account.target_roas}x` : '—'
    : account.target_cpl ? formatCurrency(account.target_cpl) : '—'

  const conversions = isEcom ? account.purchases : account.leads
  const convLabel = isEcom ? 'purch' : account.objective === 'schedule' ? 'sched' : 'leads'

  return (
    <a href={`/client/${account.client_slug}`} className="flex items-center gap-3 py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-zinc-800 transition-colors">
      <StatusIndicator status={status} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{account.client_name}</p>
        <p className="text-xs text-zinc-500">{formatNumber(conversions)} {convLabel} · {formatNumber(account.impressions)} imps</p>
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
  const totalLeads = accounts.reduce((s, a) => s + a.leads, 0)
  const totalPurchases = accounts.reduce((s, a) => s + a.purchases, 0)
  const totalImpressions = accounts.reduce((s, a) => s + a.impressions, 0)
  const totalPurchaseValue = accounts.reduce((s, a) => s + a.purchase_value, 0)
  
  const leadAccounts = accounts.filter(a => a.objective !== 'purchases')
  const totalLeadSpend = leadAccounts.reduce((s, a) => s + a.spend, 0)
  const blendedCPL = totalLeads > 0 ? totalLeadSpend / totalLeads : 0

  const activeAccounts = accounts.filter(a => a.spend > 0)
  const redAccounts = activeAccounts.filter(a => {
    const cpl = a.leads > 0 ? a.spend / a.leads : 999
    if (a.objective === 'purchases') return a.target_roas ? (a.purchase_value / a.spend) < a.target_roas * 0.7 : false
    return a.target_cpl ? cpl > a.target_cpl * 1.3 : false
  })
  const yellowAccounts = activeAccounts.filter(a => {
    const cpl = a.leads > 0 ? a.spend / a.leads : 0
    if (a.objective === 'purchases') {
      const r = a.spend > 0 ? a.purchase_value / a.spend : 0
      return a.target_roas ? r < a.target_roas && r >= a.target_roas * 0.7 : false
    }
    return a.target_cpl ? cpl > a.target_cpl && cpl <= a.target_cpl * 1.3 : false
  })

  return (
    <main className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-lg font-bold">🐎 Command</h1>
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
          <KpiCard label="Leads" value={formatNumber(totalLeads)} subtext={`${(totalLeads / 7).toFixed(0)}/day`} />
          <KpiCard label="Blended CPL" value={blendedCPL > 0 ? formatCurrency(blendedCPL) : '—'} />
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
