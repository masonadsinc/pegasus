import { getDashboardData, AccountSummary } from '@/lib/queries'
import { formatCurrency, formatNumber, cplStatusTier, roasStatusTier, statusConfig, isEcomActionType, StatusTier } from '@/lib/utils'
import { Nav } from '@/components/nav'
import { Badge } from '@/components/ui/badge'
import { Sparkline } from '@/components/sparkline'
import Link from 'next/link'

export const revalidate = 300

const ORG_ID = process.env.ADSINC_ORG_ID!

function getAccountStatus(a: AccountSummary): StatusTier {
  const isEcom = isEcomActionType(a.primary_action_type)
  if (isEcom) {
    const roas = a.spend > 0 ? a.purchase_value / a.spend : 0
    return a.target_roas ? roasStatusTier(roas, a.target_roas) : 'neutral'
  }
  const cpr = a.results > 0 ? a.spend / a.results : 0
  return a.target_cpl ? cplStatusTier(cpr, a.target_cpl) : 'neutral'
}

function ClientCard({ account }: { account: AccountSummary }) {
  const status = getAccountStatus(account)
  const config = statusConfig[status]
  const isEcom = isEcomActionType(account.primary_action_type)
  const cpr = account.results > 0 ? account.spend / account.results : 0
  const roas = account.spend > 0 ? account.purchase_value / account.spend : 0

  const primaryMetric = isEcom ? `${roas.toFixed(1)}x ROAS` : cpr > 0 ? `${formatCurrency(cpr)} CPR` : '—'
  const target = isEcom
    ? account.target_roas ? `${account.target_roas}x target` : 'No target'
    : account.target_cpl ? `${formatCurrency(account.target_cpl)} target` : 'No target'

  const sparkData = account.daily.map(d => ({ value: d.results }))
  const sparkColor = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#10b981'

  return (
    <Link href={`/clients/${account.client_slug}`}>
      <div className={`rounded-xl bg-zinc-900 border ${config.border} p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer h-full`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">{account.client_name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{account.account_name}</p>
          </div>
          <span className={`w-2.5 h-2.5 rounded-full ${config.dot} shrink-0 mt-1`} />
        </div>

        <div className="flex items-center justify-between mb-3">
          <div>
            <p className={`text-lg font-bold tabular-nums ${config.text}`}>{primaryMetric}</p>
            <p className="text-xs text-zinc-500">{target}</p>
          </div>
          <div className="w-20 h-8">
            <Sparkline data={sparkData} color={sparkColor} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-zinc-500">Spend</p>
            <p className="font-medium tabular-nums">{formatCurrency(account.spend)}</p>
          </div>
          <div>
            <p className="text-zinc-500 capitalize">{account.result_label}</p>
            <p className="font-medium tabular-nums">{formatNumber(account.results)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Impressions</p>
            <p className="font-medium tabular-nums">{formatNumber(account.impressions)}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default async function ClientsPage() {
  const accounts = await getDashboardData(ORG_ID, 7)
  const activeAccounts = accounts.filter(a => a.spend > 0)

  const counts = { excellent: 0, good: 0, warning: 0, critical: 0, neutral: 0 }
  activeAccounts.forEach(a => { counts[getAccountStatus(a)]++ })

  // Sort: critical first, then warning, then by spend within tier
  const tierOrder: Record<StatusTier, number> = { critical: 0, warning: 1, good: 2, excellent: 3, neutral: 4 }
  const sorted = [...activeAccounts].sort((a, b) => {
    const ta = tierOrder[getAccountStatus(a)]
    const tb = tierOrder[getAccountStatus(b)]
    if (ta !== tb) return ta - tb
    return b.spend - a.spend
  })

  return (
    <main className="min-h-screen pb-8">
      <Nav current="clients" />

      <div className="max-w-6xl mx-auto px-4 mt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Clients</h1>
            <p className="text-sm text-zinc-500">All client accounts · Last 7 days</p>
          </div>
          <div className="flex items-center gap-2">
            {counts.critical > 0 && <Badge variant="critical">{counts.critical} critical</Badge>}
            {counts.warning > 0 && <Badge variant="warning">{counts.warning} warning</Badge>}
            {counts.good > 0 && <Badge variant="good">{counts.good} on target</Badge>}
            {counts.excellent > 0 && <Badge variant="excellent">{counts.excellent} excellent</Badge>}
          </div>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(a => (
            <ClientCard key={a.ad_account_id} account={a} />
          ))}
        </div>

        {/* Inactive */}
        {accounts.filter(a => a.spend === 0).length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-500 mb-3">Inactive ({accounts.filter(a => a.spend === 0).length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-50">
              {accounts.filter(a => a.spend === 0).map(a => (
                <ClientCard key={a.ad_account_id} account={a} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
