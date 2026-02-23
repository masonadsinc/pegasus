import { getDashboardData, AccountSummary } from '@/lib/queries'
import { formatCurrency, formatNumber, cplStatusTier, roasStatusTier, isEcomActionType, StatusTier } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export const revalidate = 300
const ORG_ID = process.env.ADSINC_ORG_ID!

function getStatus(a: AccountSummary): StatusTier {
  const isEcom = isEcomActionType(a.primary_action_type)
  if (a.spend === 0) return 'neutral'
  if (isEcom) {
    const roas = a.spend > 0 ? a.purchase_value / a.spend : 0
    return a.target_roas ? roasStatusTier(roas, a.target_roas) : 'neutral'
  }
  const cpr = a.results > 0 ? a.spend / a.results : 0
  return a.target_cpl ? cplStatusTier(cpr, a.target_cpl) : 'neutral'
}

const statusBadge: Record<StatusTier, { label: string; variant: any }> = {
  excellent: { label: 'Excellent', variant: 'excellent' },
  good: { label: 'On Track', variant: 'onTarget' },
  warning: { label: 'Watch', variant: 'warning' },
  critical: { label: 'Attention', variant: 'attention' },
  neutral: { label: 'No Data', variant: 'noData' },
}

function DotHeatmap({ daily }: { daily: AccountSummary['daily'] }) {
  // Pad to 30 days
  const dots = []
  for (let i = 0; i < 30; i++) {
    const day = daily[daily.length - 30 + i]
    if (!day || day.spend === 0) {
      dots.push('bg-[#e5e5e5]')
    } else if (day.results > 0) {
      dots.push('bg-[#34c759]')
    } else {
      dots.push('bg-[#ff3b30]')
    }
  }
  return (
    <div className="flex gap-[3px]">
      {dots.map((c, i) => (
        <div key={i} className={`w-[7px] h-[7px] rounded-full ${c}`} />
      ))}
    </div>
  )
}

function DaysOnTarget({ daily, targetCpl, targetRoas, isEcom }: { daily: AccountSummary['daily']; targetCpl: number | null; targetRoas: number | null; isEcom: boolean }) {
  if (!daily.length) return null
  const last30 = daily.slice(-30)
  let onTarget = 0
  for (const d of last30) {
    if (d.spend === 0) continue
    if (isEcom) {
      const roas = d.spend > 0 ? d.purchase_value / d.spend : 0
      if (targetRoas && roas >= targetRoas) onTarget++
    } else {
      const cpr = d.results > 0 ? d.spend / d.results : 999
      if (targetCpl && cpr <= targetCpl) onTarget++
    }
  }
  const daysWithSpend = last30.filter(d => d.spend > 0).length
  const pct = daysWithSpend > 0 ? (onTarget / daysWithSpend) * 100 : 0
  const color = pct >= 70 ? '#34c759' : pct >= 40 ? '#ff9500' : '#ff3b30'

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-[#86868b] mb-1">
        <span>{onTarget}/{daysWithSpend} days on target</span>
      </div>
      <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function ClientCard({ account }: { account: AccountSummary }) {
  const status = getStatus(account)
  const badge = statusBadge[status]
  const isEcom = isEcomActionType(account.primary_action_type)
  const cpr = account.results > 0 ? account.spend / account.results : 0
  const roas = account.spend > 0 ? account.purchase_value / account.spend : 0

  return (
    <Link href={`/clients/${account.client_slug}`}>
      <div className="rounded-2xl bg-white border border-[#e5e5e5] p-5 hover:shadow-md transition-all cursor-pointer h-full">
        {/* Dot Heatmap */}
        <div className="mb-3">
          <p className="text-[10px] text-[#aeaeb2] uppercase tracking-wider mb-1.5">Last 30 Days</p>
          <DotHeatmap daily={account.daily} />
        </div>

        {/* Name + Badge */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-[14px] text-[#1d1d1f]">{account.client_name}</h3>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        {/* Days on Target */}
        <div className="mb-4">
          <DaysOnTarget
            daily={account.daily}
            targetCpl={account.target_cpl}
            targetRoas={account.target_roas}
            isEcom={isEcom}
          />
        </div>

        {/* Metrics */}
        <p className="text-[10px] text-[#aeaeb2] uppercase tracking-wider mb-2">Last 7 Days</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-[#86868b]">$ Spend</span>
            <span className="font-semibold tabular-nums">{formatCurrency(account.spend)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#86868b]">📊 {account.result_label}</span>
            <span className="font-semibold tabular-nums">{formatNumber(account.results)}</span>
          </div>
        </div>

        {/* CPL/ROAS vs Target */}
        <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
          {isEcom ? (
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${roas >= (account.target_roas || 0) ? 'bg-[#34c759]' : 'bg-[#ff3b30]'}`} />
                <span className="text-[#86868b]">ROAS</span>
                <span className="font-bold tabular-nums">{roas.toFixed(2)}x</span>
              </div>
              <div className="text-[#aeaeb2] text-[12px]">
                Target <span className="font-medium">{account.target_roas || '—'}x</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cpr <= (account.target_cpl || 999) ? 'bg-[#34c759]' : 'bg-[#ff3b30]'}`} />
                <span className="text-[#86868b]">CPR</span>
                <span className={`font-bold tabular-nums ${cpr > (account.target_cpl || 999) ? 'text-[#ff3b30]' : 'text-[#34c759]'}`}>
                  {cpr > 0 ? formatCurrency(cpr) : '—'}
                </span>
              </div>
              <div className="text-[#aeaeb2] text-[12px]">
                Target <span className="font-medium">{account.target_cpl ? formatCurrency(account.target_cpl) : '—'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default async function ClientsPage() {
  const accounts = await getDashboardData(ORG_ID, 30) // 30 days for heatmap

  const activeAccounts = accounts.filter(a => a.spend > 0)
  const counts = { excellent: 0, good: 0, warning: 0, critical: 0, neutral: 0 }
  activeAccounts.forEach(a => { counts[getStatus(a)]++ })

  const tierOrder: Record<StatusTier, number> = { critical: 0, warning: 1, good: 2, excellent: 3, neutral: 4 }
  const sorted = [...accounts].sort((a, b) => {
    const ta = tierOrder[getStatus(a)]
    const tb = tierOrder[getStatus(b)]
    if (ta !== tb) return ta - tb
    return b.spend - a.spend
  })

  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-6 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-[#1d1d1f]">Clients</h1>
              <p className="text-[13px] text-[#86868b]">All client accounts · Last 7 days</p>
            </div>
            <div className="flex items-center gap-3 text-[12px]">
              {counts.critical > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ff3b30]" />{counts.critical} critical</span>}
              {counts.warning > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ff9500]" />{counts.warning} over target</span>}
              {(counts.good + counts.excellent) > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#34c759]" />{counts.good + counts.excellent} on target</span>}
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map(a => (
              <ClientCard key={a.ad_account_id} account={a} />
            ))}
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
