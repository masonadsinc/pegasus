import { getDashboardData } from '@/lib/queries'
import { formatCurrency, formatNumber, cplStatus, roasStatus, statusDot } from '@/lib/utils'

const ORG_ID = process.env.ADSINC_ORG_ID!

// Revalidate every 5 minutes
export const revalidate = 300

function KpiCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtext && <p className="text-xs text-zinc-500 mt-1">{subtext}</p>}
    </div>
  )
}

function StatusIndicator({ status }: { status: 'green' | 'yellow' | 'red' }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusDot(status)}`} />
}

function AccountCard({ account }: { account: any }) {
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
    ? `${roas.toFixed(2)}x ROAS`
    : cpl > 0 ? `${formatCurrency(cpl)} CPL` : 'No conversions'
  
  const target = isEcom
    ? account.target_roas ? `Target: ${account.target_roas}x` : ''
    : account.target_cpl ? `Target: ${formatCurrency(account.target_cpl)}` : ''

  const conversions = isEcom ? account.purchases : account.leads
  const convLabel = isEcom ? 'purchases' : account.objective === 'schedule' ? 'schedules' : 'leads'

  return (
    <a href={`/client/${account.client_slug}`} className="block rounded-xl bg-zinc-900 border border-zinc-800 p-5 hover:border-zinc-600 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm truncate pr-2">{account.client_name}</h3>
        <StatusIndicator status={status} />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Spend</span>
          <span className="font-medium">{formatCurrency(account.spend)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">{primaryMetric}</span>
          <span className="text-zinc-500">{target}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">{formatNumber(conversions)} {convLabel}</span>
          <span className="text-zinc-500">{formatNumber(account.impressions)} imps</span>
        </div>
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
  const blendedROAS = totalSpend > 0 ? totalPurchaseValue / totalSpend : 0

  const activeAccounts = accounts.filter(a => a.spend > 0)
  const redAccounts = activeAccounts.filter(a => {
    const cpl = a.leads > 0 ? a.spend / a.leads : 999
    if (a.objective === 'purchases') return a.target_roas ? (a.purchase_value / a.spend) < a.target_roas * 0.7 : false
    return a.target_cpl ? cpl > a.target_cpl * 1.3 : false
  })

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">🐎 Pegasus Command</h1>
          <p className="text-zinc-400 text-sm mt-1">Last 7 days · {activeAccounts.length} active accounts</p>
        </div>
        <div className="text-right text-sm text-zinc-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard label="Total Spend" value={formatCurrency(totalSpend)} subtext={`${formatCurrency(totalSpend / 7)}/day avg`} />
        <KpiCard label="Total Leads" value={formatNumber(totalLeads)} subtext={`${(totalLeads / 7).toFixed(0)}/day avg`} />
        <KpiCard label="Blended CPL" value={blendedCPL > 0 ? formatCurrency(blendedCPL) : '—'} />
        <KpiCard label="Purchases" value={formatNumber(totalPurchases)} subtext={totalPurchaseValue > 0 ? formatCurrency(totalPurchaseValue) + ' rev' : undefined} />
        <KpiCard label="Impressions" value={formatNumber(totalImpressions)} />
        <KpiCard label="Attention" value={`${redAccounts.length} accounts`} subtext={redAccounts.length > 0 ? '⚠️ Over target' : '✅ All healthy'} />
      </div>

      {/* Attention Queue */}
      {redAccounts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-red-400">⚠️ Needs Attention</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {redAccounts.map(a => (
              <AccountCard key={a.ad_account_id} account={a} />
            ))}
          </div>
        </div>
      )}

      {/* All Accounts Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-3">All Accounts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {accounts.filter(a => a.spend > 0).map(a => (
            <AccountCard key={a.ad_account_id} account={a} />
          ))}
        </div>
      </div>

      {/* Inactive */}
      {accounts.filter(a => a.spend === 0).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3 text-zinc-500">Inactive</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-50">
            {accounts.filter(a => a.spend === 0).map(a => (
              <AccountCard key={a.ad_account_id} account={a} />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
