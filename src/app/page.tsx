import { getDashboardData } from '@/lib/queries'
import { formatCurrency, formatNumber, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 300

function MiniBar({ data, color = '#2563eb' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-[2px] h-[28px]">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all duration-200 hover:opacity-90" style={{ height: `${Math.max((v / max) * 100, 6)}%`, backgroundColor: color, opacity: i === data.length - 1 ? 0.8 : 0.35 }} />
      ))}
    </div>
  )
}

function WowBadge({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (!previous || !current) return null
  const pct = ((current - previous) / previous) * 100
  const isGood = invert ? pct < 0 : pct > 0
  if (Math.abs(pct) < 1) return null
  return (
    <span className={`text-[11px] font-medium ${isGood ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export default async function Dashboard() {
  const accounts = await getDashboardData(ORG_ID, 14) // fetch 14 days for WoW

  const activeAccounts = accounts.filter(a => a.spend > 0)

  // This week vs last week
  const twSpend = accounts.reduce((s, a) => s + a.daily.slice(-7).reduce((ds, d) => ds + d.spend, 0), 0)
  const lwSpend = accounts.reduce((s, a) => s + a.daily.slice(0, 7).reduce((ds, d) => ds + d.spend, 0), 0)
  const twResults = accounts.reduce((s, a) => s + a.daily.slice(-7).reduce((ds, d) => ds + d.results, 0), 0)
  const lwResults = accounts.reduce((s, a) => s + a.daily.slice(0, 7).reduce((ds, d) => ds + d.results, 0), 0)

  const nonEcom = activeAccounts.filter(a => !isEcomActionType(a.primary_action_type))
  const nonEcomTwSpend = nonEcom.reduce((s, a) => s + a.daily.slice(-7).reduce((ds, d) => ds + d.spend, 0), 0)
  const nonEcomTwResults = nonEcom.reduce((s, a) => s + a.daily.slice(-7).reduce((ds, d) => ds + d.results, 0), 0)
  const nonEcomLwSpend = nonEcom.reduce((s, a) => s + a.daily.slice(0, 7).reduce((ds, d) => ds + d.spend, 0), 0)
  const nonEcomLwResults = nonEcom.reduce((s, a) => s + a.daily.slice(0, 7).reduce((ds, d) => ds + d.results, 0), 0)
  const twCPR = nonEcomTwResults > 0 ? nonEcomTwSpend / nonEcomTwResults : 0
  const lwCPR = nonEcomLwResults > 0 ? nonEcomLwSpend / nonEcomLwResults : 0

  // Alerts: accounts over target
  const alerts = activeAccounts.filter(a => {
    if (!a.target_cpl) return false
    const cpr = a.results > 0 ? a.spend / a.results : 0
    return cpr > 0 && cpr > a.target_cpl * 1.25
  })

  // Today's spend (last day of data)
  const todaySpend = accounts.reduce((s, a) => {
    const last = a.daily[a.daily.length - 1]
    return s + (last?.spend || 0)
  }, 0)

  return (
    <>
      <Nav current="dashboard" />
      <PageWrapper>
        <div className="p-6 max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[13px] text-[#9d9da8] mb-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })}</p>
              <h2 className="text-xl font-bold text-[#111113]">Health Tracker</h2>
            </div>
            {alerts.length > 0 && (
              <div className="flex items-center gap-2 bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-[#dc2626] animate-pulse" />
                <span className="text-[12px] text-[#dc2626] font-medium">{alerts.length} account{alerts.length > 1 ? 's' : ''} over target</span>
              </div>
            )}
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card className="p-5 card-hover border-l-[3px] border-l-[#2563eb]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-lg bg-[#eff6ff] flex items-center justify-center text-[11px]">💰</span>
                <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider">Weekly Spend</p>
              </div>
              <p className="text-[28px] font-bold tabular-nums text-[#111113]">{formatCurrency(twSpend)}</p>
              <div className="flex items-center gap-2">
                <p className="text-[12px] text-[#9d9da8]">{formatCurrency(twSpend / 7)}/day</p>
                <WowBadge current={twSpend} previous={lwSpend} />
              </div>
            </Card>
            <Card className="p-5 card-hover border-l-[3px] border-l-[#16a34a]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-lg bg-[#f0fdf4] flex items-center justify-center text-[11px]">🎯</span>
                <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider">Weekly Results</p>
              </div>
              <p className="text-[28px] font-bold tabular-nums text-[#111113]">{formatNumber(twResults)}</p>
              <div className="flex items-center gap-2">
                <p className="text-[12px] text-[#9d9da8]">{(twResults / 7).toFixed(0)}/day</p>
                <WowBadge current={twResults} previous={lwResults} />
              </div>
            </Card>
            <Card className="p-5 card-hover border-l-[3px] border-l-[#ea580c]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-lg bg-[#fff7ed] flex items-center justify-center text-[11px]">📊</span>
                <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider">Blended CPR</p>
              </div>
              <p className="text-[28px] font-bold tabular-nums text-[#111113]">{twCPR > 0 ? formatCurrency(twCPR) : '—'}</p>
              <div className="flex items-center gap-2">
                <p className="text-[12px] text-[#9d9da8]">Non-ecom</p>
                <WowBadge current={twCPR} previous={lwCPR} invert />
              </div>
            </Card>
            <Card className="p-5 card-hover border-l-[3px] border-l-[#8b5cf6]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-lg bg-[#f5f3ff] flex items-center justify-center text-[11px]">⚡</span>
                <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider">Today&apos;s Spend</p>
              </div>
              <p className="text-[28px] font-bold tabular-nums text-[#111113]">{formatCurrency(todaySpend)}</p>
              <p className="text-[12px] text-[#9d9da8]">So far today</p>
            </Card>
            <Card className="p-5 card-hover border-l-[3px] border-l-[#111113]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-lg bg-[#f4f4f6] flex items-center justify-center text-[11px]">👥</span>
                <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider">Active Accounts</p>
              </div>
              <p className="text-[28px] font-bold tabular-nums text-[#111113]">{activeAccounts.length}</p>
              <p className="text-[12px] text-[#9d9da8]">{accounts.length} total</p>
            </Card>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <Card className="p-4 mb-6 border-[#fecaca]">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#dc2626]" />
                <h3 className="text-[13px] font-semibold text-[#dc2626]">Accounts Over Target</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {alerts.map(a => {
                  const cpr = a.results > 0 ? a.spend / a.results : 0
                  const overPct = a.target_cpl ? ((cpr / a.target_cpl - 1) * 100).toFixed(0) : '?'
                  return (
                    <Link key={a.ad_account_id} href={`/clients/${a.client_slug}`} className="flex items-center justify-between p-2.5 rounded-lg bg-[#fef2f2] hover:bg-[#fee2e2] transition-colors">
                      <span className="text-[12px] font-medium">{a.client_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-[#dc2626] tabular-nums">{formatCurrency(cpr)}</span>
                        <Badge variant="danger">+{overPct}%</Badge>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Account Table */}
          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec] flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#111113]">All Accounts</h3>
              <span className="text-[12px] text-[#9d9da8]">{activeAccounts.length} active</span>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#e8e8ec]">
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Client</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Spend</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Results</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPR</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">vs Target</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CTR</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider w-[100px]">7d Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAccounts.map(a => {
                    const tw7 = a.daily.slice(-7)
                    const twSpendAcct = tw7.reduce((s, d) => s + d.spend, 0)
                    const twResultsAcct = tw7.reduce((s, d) => s + d.results, 0)
                    const cpr = twResultsAcct > 0 ? twSpendAcct / twResultsAcct : 0
                    const isOver = a.target_cpl ? cpr > a.target_cpl : false
                    const ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0
                    const targetPct = a.target_cpl && cpr > 0 ? ((cpr / a.target_cpl - 1) * 100) : null
                    return (
                      <tr key={a.ad_account_id} className={`border-b border-[#f4f4f6] hover:bg-[#f0f4ff] transition-colors group ${isOver ? 'bg-[#fef2f2]/30' : ''}`}>
                        <td className="py-3 px-5">
                          <Link href={`/clients/${a.client_slug}`} className="font-medium text-[#111113] group-hover:text-[#2563eb] transition-colors">{a.client_name}</Link>
                          <p className="text-[11px] text-[#9d9da8] mt-0.5">{a.result_label}</p>
                        </td>
                        <td className="py-3 px-5 text-right tabular-nums font-medium">{formatCurrency(twSpendAcct)}</td>
                        <td className="py-3 px-5 text-right tabular-nums text-[#6b6b76]">{formatNumber(twResultsAcct)}</td>
                        <td className={`py-3 px-5 text-right tabular-nums font-semibold ${isOver ? 'text-[#dc2626]' : cpr > 0 ? 'text-[#16a34a]' : 'text-[#9d9da8]'}`}>
                          {cpr > 0 ? formatCurrency(cpr) : '—'}
                        </td>
                        <td className="py-3 px-5 text-right">
                          {targetPct !== null ? (
                            <span className={`text-[11px] font-medium ${targetPct > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                              {targetPct > 0 ? '+' : ''}{targetPct.toFixed(0)}%
                            </span>
                          ) : <span className="text-[#c4c4cc]">—</span>}
                        </td>
                        <td className="py-3 px-5 text-right tabular-nums text-[#9d9da8]">{ctr > 0 ? `${ctr.toFixed(2)}%` : '—'}</td>
                        <td className="py-3 px-5">
                          <MiniBar data={tw7.map(d => d.spend)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </PageWrapper>
    </>
  )
}
