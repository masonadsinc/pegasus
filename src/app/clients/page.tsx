import { getDashboardData, AccountSummary } from '@/lib/queries'
import { formatCurrency, formatNumber, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export const revalidate = 300
const ORG_ID = process.env.ADSINC_ORG_ID!

type Status = 'on-target' | 'over' | 'critical' | 'no-data'

function getStatus(a: AccountSummary): Status {
  if (a.spend === 0) return 'no-data'
  const isEcom = isEcomActionType(a.primary_action_type)
  if (isEcom) {
    const roas = a.spend > 0 ? a.purchase_value / a.spend : 0
    if (!a.target_roas) return 'no-data'
    return roas >= a.target_roas ? 'on-target' : roas >= a.target_roas * 0.75 ? 'over' : 'critical'
  }
  const cpr = a.results > 0 ? a.spend / a.results : 0
  if (!a.target_cpl || cpr === 0) return 'no-data'
  return cpr <= a.target_cpl ? 'on-target' : cpr <= a.target_cpl * 1.25 ? 'over' : 'critical'
}

const statusConfig: Record<Status, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  'on-target': { label: 'On Target', variant: 'success' },
  'over': { label: 'Over Target', variant: 'warning' },
  'critical': { label: 'Critical', variant: 'danger' },
  'no-data': { label: 'No Target', variant: 'neutral' },
}

function SparkArea({ daily }: { daily: AccountSummary['daily'] }) {
  const data = daily.slice(-14).map(d => d.spend)
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 120
  const h = 32
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
  const fillPoints = [`0,${h}`, ...points, `${w},${h}`]

  return (
    <svg width={w} height={h} className="opacity-50">
      <polygon points={fillPoints.join(' ')} fill="rgba(59,130,246,0.15)" />
      <polyline points={points.join(' ')} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
    </svg>
  )
}

function ClientRow({ account }: { account: AccountSummary }) {
  const status = getStatus(account)
  const cfg = statusConfig[status]
  const isEcom = isEcomActionType(account.primary_action_type)
  const cpr = account.results > 0 ? account.spend / account.results : 0
  const roas = account.spend > 0 ? account.purchase_value / account.spend : 0

  return (
    <Link href={`/clients/${account.client_slug}`} className="block">
      <div className="flex items-center px-5 py-4 border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors cursor-pointer gap-4">
        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-white truncate">{account.client_name}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{account.result_label}</p>
        </div>

        {/* Spark */}
        <div className="hidden md:block">
          <SparkArea daily={account.daily} />
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-6 text-right">
          <div className="w-20">
            <p className="text-[11px] text-zinc-500">Spend</p>
            <p className="text-[13px] font-medium text-white tabular-nums">{formatCurrency(account.spend)}</p>
          </div>
          <div className="w-16">
            <p className="text-[11px] text-zinc-500">Results</p>
            <p className="text-[13px] font-medium text-zinc-300 tabular-nums">{formatNumber(account.results)}</p>
          </div>
          <div className="w-20">
            <p className="text-[11px] text-zinc-500">{isEcom ? 'ROAS' : 'CPR'}</p>
            <p className={`text-[13px] font-semibold tabular-nums ${
              status === 'on-target' ? 'text-emerald-400' :
              status === 'critical' ? 'text-red-400' :
              status === 'over' ? 'text-amber-400' : 'text-zinc-400'
            }`}>
              {isEcom ? (roas > 0 ? `${roas.toFixed(2)}x` : '—') : (cpr > 0 ? formatCurrency(cpr) : '—')}
            </p>
          </div>
          <div className="w-20">
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default async function ClientsPage() {
  const accounts = await getDashboardData(ORG_ID, 14)

  const statusOrder: Record<Status, number> = { critical: 0, over: 1, 'on-target': 2, 'no-data': 3 }
  const sorted = [...accounts].sort((a, b) => {
    const sa = statusOrder[getStatus(a)]
    const sb = statusOrder[getStatus(b)]
    if (sa !== sb) return sa - sb
    return b.spend - a.spend
  })

  const active = sorted.filter(a => a.spend > 0)
  const inactive = sorted.filter(a => a.spend === 0)

  const onTarget = active.filter(a => getStatus(a) === 'on-target').length
  const over = active.filter(a => getStatus(a) === 'over').length
  const critical = active.filter(a => getStatus(a) === 'critical').length

  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-white">Clients</h1>
              <p className="text-sm text-zinc-500 mt-1">All client accounts — last 7 days</p>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-zinc-400">
              {critical > 0 && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{critical} critical</span>}
              {over > 0 && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{over} over target</span>}
              {onTarget > 0 && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{onTarget} on target</span>}
            </div>
          </div>

          {/* Active Accounts */}
          <Card className="mb-6">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-medium text-white">Active Accounts</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">{active.length} accounts with spend</p>
            </div>
            {active.map(a => <ClientRow key={a.ad_account_id} account={a} />)}
          </Card>

          {/* Inactive */}
          {inactive.length > 0 && (
            <Card>
              <div className="px-5 py-4 border-b border-zinc-800">
                <h2 className="text-sm font-medium text-zinc-400">Inactive</h2>
                <p className="text-[11px] text-zinc-600 mt-0.5">{inactive.length} accounts with no spend</p>
              </div>
              {inactive.map(a => (
                <div key={a.ad_account_id} className="flex items-center px-5 py-3 border-b border-zinc-800/30">
                  <p className="text-[13px] text-zinc-500">{a.client_name}</p>
                  <span className="ml-auto text-[11px] text-zinc-600">No spend</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </PageWrapper>
    </>
  )
}
