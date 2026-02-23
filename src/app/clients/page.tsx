import { getDashboardData, AccountSummary } from '@/lib/queries'
import { formatCurrency, formatNumber, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export const revalidate = 300
const ORG_ID = process.env.ADSINC_ORG_ID!

type Status = 'excellent' | 'on-track' | 'watch' | 'attention' | 'no-data'

function getStatus(a: AccountSummary): Status {
  if (a.spend === 0) return 'no-data'
  const isEcom = isEcomActionType(a.primary_action_type)
  if (isEcom) {
    const roas = a.spend > 0 ? a.purchase_value / a.spend : 0
    if (!a.target_roas) return 'no-data'
    if (roas >= a.target_roas * 1.25) return 'excellent'
    if (roas >= a.target_roas) return 'on-track'
    if (roas >= a.target_roas * 0.75) return 'watch'
    return 'attention'
  }
  const cpr = a.results > 0 ? a.spend / a.results : 0
  if (!a.target_cpl || cpr === 0) return 'no-data'
  if (cpr <= a.target_cpl * 0.85) return 'excellent'
  if (cpr <= a.target_cpl) return 'on-track'
  if (cpr <= a.target_cpl * 1.25) return 'watch'
  return 'attention'
}

const statusCfg: Record<Status, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'neutral'; dot: string }> = {
  excellent: { label: 'Excellent', variant: 'success', dot: 'bg-[#16a34a]' },
  'on-track': { label: 'On Track', variant: 'info', dot: 'bg-[#2563eb]' },
  watch: { label: 'Watch', variant: 'warning', dot: 'bg-[#ea580c]' },
  attention: { label: 'Attention', variant: 'danger', dot: 'bg-[#dc2626]' },
  'no-data': { label: 'No Data', variant: 'neutral', dot: 'bg-[#9d9da8]' },
}

function DotHeatmap({ daily }: { daily: AccountSummary['daily'] }) {
  const dots = []
  for (let i = 0; i < 30; i++) {
    const day = daily[daily.length - 30 + i]
    if (!day || day.spend === 0) dots.push('bg-[#e8e8ec]')
    else if (day.results > 0) dots.push('bg-[#16a34a]')
    else dots.push('bg-[#dc2626]')
  }
  return (
    <div className="flex gap-[3px]">
      {dots.map((c, i) => <div key={i} className={`w-[7px] h-[7px] rounded-full ${c}`} />)}
    </div>
  )
}

function DaysOnTarget({ daily, targetCpl, targetRoas, isEcom }: { daily: AccountSummary['daily']; targetCpl: number | null; targetRoas: number | null; isEcom: boolean }) {
  const last30 = daily.slice(-30)
  let onTarget = 0
  let daysWithSpend = 0
  for (const d of last30) {
    if (d.spend === 0) continue
    daysWithSpend++
    if (isEcom) {
      const roas = d.spend > 0 ? d.purchase_value / d.spend : 0
      if (targetRoas && roas >= targetRoas) onTarget++
    } else {
      const cpr = d.results > 0 ? d.spend / d.results : 999
      if (targetCpl && cpr <= targetCpl) onTarget++
    }
  }
  if (!daysWithSpend) return null
  const pct = (onTarget / daysWithSpend) * 100
  const color = pct >= 60 ? '#16a34a' : pct >= 40 ? '#ea580c' : '#dc2626'
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-[#9d9da8] mb-1">
        <span>{onTarget}/{daysWithSpend} days on target</span>
      </div>
      <div className="h-1.5 bg-[#f4f4f6] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function ClientCard({ account }: { account: AccountSummary }) {
  const status = getStatus(account)
  const cfg = statusCfg[status]
  const isEcom = isEcomActionType(account.primary_action_type)
  const cpr = account.results > 0 ? account.spend / account.results : 0
  const roas = account.spend > 0 ? account.purchase_value / account.spend : 0
  const cprOnTarget = account.target_cpl ? cpr <= account.target_cpl : undefined
  const roasOnTarget = account.target_roas ? roas >= account.target_roas : undefined

  return (
    <Link href={`/clients/${account.client_slug}`}>
      <div className="rounded-xl bg-white border border-[#e8e8ec] p-5 hover:shadow-md transition-all cursor-pointer h-full">
        {/* 30-day heatmap */}
        <div className="mb-3">
          <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider mb-1.5">Last 30 Days</p>
          <DotHeatmap daily={account.daily} />
        </div>

        {/* Name + Status */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-[14px] text-[#111113]">{account.client_name}</h3>
          </div>
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        </div>

        {/* Days on Target */}
        <div className="mb-4">
          <DaysOnTarget daily={account.daily} targetCpl={account.target_cpl} targetRoas={account.target_roas} isEcom={isEcom} />
        </div>

        {/* Last 7 Days */}
        <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider mb-2">Last 7 Days</p>
        <div className="flex items-center justify-between text-[13px] mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[#9d9da8] text-[12px]">$</span>
            <span className="text-[#9d9da8] text-[12px]">Spend</span>
          </div>
          <span className="font-semibold tabular-nums">{formatCurrency(account.spend)}</span>
          {isEcom ? (
            <div className="flex items-center gap-4">
              <span className="text-[12px] text-[#9d9da8]">Revenue</span>
              <span className="font-semibold tabular-nums">{formatCurrency(account.purchase_value)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-[12px] text-[#9d9da8]">{account.result_label}</span>
              <span className="font-semibold tabular-nums">{formatNumber(account.results)}</span>
            </div>
          )}
        </div>

        {/* CPL/ROAS vs Target */}
        <div className="mt-3 pt-3 border-t border-[#f4f4f6]">
          {isEcom ? (
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${roasOnTarget ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`} />
                <span className="text-[#9d9da8] text-[12px]">ROAS</span>
                <span className="font-bold tabular-nums">{roas.toFixed(2)}x</span>
              </div>
              <div className="text-[12px] text-[#9d9da8]">
                Target <span className="font-medium">{account.target_roas || '—'}x</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cprOnTarget === true ? 'bg-[#16a34a]' : cprOnTarget === false ? 'bg-[#dc2626]' : 'bg-[#9d9da8]'}`} />
                <span className="text-[#9d9da8] text-[12px]">CPR</span>
                <span className={`font-bold tabular-nums ${cprOnTarget === false ? 'text-[#dc2626]' : cprOnTarget === true ? 'text-[#16a34a]' : ''}`}>
                  {cpr > 0 ? formatCurrency(cpr) : '—'}
                </span>
              </div>
              <div className="text-[12px] text-[#9d9da8]">
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
  const accounts = await getDashboardData(ORG_ID, 30)

  const statusOrder: Record<Status, number> = { attention: 0, watch: 1, 'on-track': 2, excellent: 3, 'no-data': 4 }
  const sorted = [...accounts].sort((a, b) => {
    const sa = statusOrder[getStatus(a)]
    const sb = statusOrder[getStatus(b)]
    if (sa !== sb) return sa - sb
    return b.spend - a.spend
  })

  const counts = { attention: 0, watch: 0, 'on-track': 0, excellent: 0, 'no-data': 0 }
  sorted.forEach(a => { counts[getStatus(a)]++ })

  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-6 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#111113]">Clients</h2>
              <p className="text-[13px] text-[#9d9da8]">All client accounts · Last 7 days</p>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-[#6b6b76]">
              {counts.attention > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#dc2626]" />{counts.attention} critical</span>}
              {counts.watch > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#ea580c]" />{counts.watch} over target</span>}
              {(counts['on-track'] + counts.excellent) > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#16a34a]" />{counts['on-track'] + counts.excellent} on target</span>}
            </div>
          </div>

          {/* Sort bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1 bg-white border border-[#e8e8ec] rounded-lg p-1">
              <span className="px-3 py-1 rounded-md bg-[#dc2626] text-white text-[12px] font-medium">All</span>
              <span className="px-3 py-1 rounded-md text-[12px] text-[#6b6b76] hover:bg-[#f4f4f6] cursor-pointer">Active</span>
              <span className="px-3 py-1 rounded-md text-[12px] text-[#6b6b76] hover:bg-[#f4f4f6] cursor-pointer">Needs Attention</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#9d9da8]">
              <span>Sort:</span>
              <span className="font-medium text-[#6b6b76]">Performance</span>
              <span className="text-[#c4c4cc]">Spend</span>
              <span className="text-[#c4c4cc]">Name</span>
            </div>
          </div>

          {/* Card Grid */}
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
