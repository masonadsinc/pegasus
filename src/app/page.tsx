import { getDashboardData } from '@/lib/queries'
import { formatCurrency, formatNumber, formatPercent, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 300

type HealthStatus = 'critical' | 'warning' | 'healthy' | 'no-data'

function getHealthScore(account: any) {
  const tw7 = account.daily.slice(-7)
  const lw7 = account.daily.slice(0, 7)
  const twSpend = tw7.reduce((s: number, d: any) => s + d.spend, 0)
  const twResults = tw7.reduce((s: number, d: any) => s + d.results, 0)
  const lwSpend = lw7.reduce((s: number, d: any) => s + d.spend, 0)
  const lwResults = lw7.reduce((s: number, d: any) => s + d.results, 0)
  const cpr = twResults > 0 ? twSpend / twResults : 0
  const lwCpr = lwResults > 0 ? lwSpend / lwResults : 0
  const cprWow = lwCpr > 0 && cpr > 0 ? ((cpr - lwCpr) / lwCpr) * 100 : 0
  const spendWow = lwSpend > 0 ? ((twSpend - lwSpend) / lwSpend) * 100 : 0

  // vs target
  const vsTgt = account.target_cpl && cpr > 0 ? ((cpr / account.target_cpl - 1) * 100) : null

  // Spend consistency: how many of last 7 days had spend?
  const activeDays = tw7.filter((d: any) => d.spend > 0).length

  // Zero results days with spend
  const zeroResultDays = tw7.filter((d: any) => d.spend > 20 && d.results === 0).length

  // Health score: 100 = perfect, 0 = terrible
  let score = 100

  // vs Target penalty (biggest factor)
  if (vsTgt !== null) {
    if (vsTgt > 50) score -= 50
    else if (vsTgt > 25) score -= 35
    else if (vsTgt > 10) score -= 15
    else if (vsTgt > 0) score -= 5
    else score += 5 // under target = bonus
  }

  // CPR trending worse WoW
  if (cprWow > 30) score -= 20
  else if (cprWow > 15) score -= 10
  else if (cprWow < -15) score += 5

  // Zero result days penalty
  score -= zeroResultDays * 8

  // Low activity days
  if (activeDays < 5) score -= 10

  // No results at all
  if (twResults === 0 && twSpend > 50) score -= 30

  let status: HealthStatus = 'healthy'
  if (cpr === 0 && twSpend < 10) status = 'no-data'
  else if (score < 40) status = 'critical'
  else if (score < 70) status = 'warning'

  const ctr = account.impressions > 0 ? (account.clicks / account.impressions) * 100 : 0
  const cpc = account.clicks > 0 ? account.spend / account.clicks : 0
  const cpm = account.impressions > 0 ? (account.spend / account.impressions) * 1000 : 0
  const convRate = account.clicks > 0 ? (account.results / account.clicks) * 100 : 0

  return {
    score: Math.max(0, Math.min(100, score)),
    status,
    twSpend,
    twResults,
    lwSpend,
    lwResults,
    cpr,
    lwCpr,
    cprWow,
    spendWow,
    vsTgt,
    activeDays,
    zeroResultDays,
    ctr,
    cpc,
    cpm,
    convRate,
    tw7,
  }
}

function StatusDot({ status }: { status: HealthStatus }) {
  const colors = {
    critical: 'bg-[#dc2626]',
    warning: 'bg-[#f59e0b]',
    healthy: 'bg-[#16a34a]',
    'no-data': 'bg-[#d4d4d8]',
  }
  return <span className={`w-2 h-2 rounded-full ${colors[status]} inline-block flex-shrink-0`} />
}

function StatusLabel({ status }: { status: HealthStatus }) {
  const config = {
    critical: { text: 'Critical', color: 'text-[#dc2626]', bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]' },
    warning: { text: 'Warning', color: 'text-[#92400e]', bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]' },
    healthy: { text: 'Healthy', color: 'text-[#16a34a]', bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]' },
    'no-data': { text: 'No Data', color: 'text-[#9d9da8]', bg: 'bg-[#f4f4f6]', border: 'border-[#e8e8ec]' },
  }
  const c = config[status]
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${c.color} ${c.bg} border ${c.border}`}>
      {c.text}
    </span>
  )
}

function MiniBar({ data, color = '#2563eb' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-[2px] h-[28px]">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-[1px] transition-all duration-200" style={{ height: `${Math.max((v / max) * 100, 6)}%`, backgroundColor: color, opacity: i === data.length - 1 ? 0.85 : 0.3 }} />
      ))}
    </div>
  )
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#dc2626'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-[#e8e8ec] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] tabular-nums font-medium" style={{ color }}>{score}</span>
    </div>
  )
}

function WowArrow({ value, invert = false }: { value: number; invert?: boolean }) {
  if (Math.abs(value) < 1) return <span className="text-[10px] text-[#9d9da8]">--</span>
  const isGood = invert ? value < 0 : value > 0
  return (
    <span className={`text-[11px] font-medium tabular-nums ${isGood ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
      {value > 0 ? '+' : ''}{value.toFixed(0)}%
    </span>
  )
}

function IssueTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded px-1.5 py-0.5 font-medium">
      {children}
    </span>
  )
}

function WarningTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded px-1.5 py-0.5 font-medium">
      {children}
    </span>
  )
}

export default async function Dashboard() {
  const accounts = await getDashboardData(ORG_ID, 14)
  const activeAccounts = accounts.filter(a => a.spend > 0)

  // Compute health for all active accounts
  const scored = activeAccounts.map(a => ({
    ...a,
    health: getHealthScore(a),
  })).sort((a, b) => a.health.score - b.health.score) // worst first

  const critical = scored.filter(a => a.health.status === 'critical')
  const warning = scored.filter(a => a.health.status === 'warning')
  const healthy = scored.filter(a => a.health.status === 'healthy')
  const noData = scored.filter(a => a.health.status === 'no-data')

  const totalTwSpend = scored.reduce((s, a) => s + a.health.twSpend, 0)
  const totalTwResults = scored.reduce((s, a) => s + a.health.twResults, 0)
  const totalLwSpend = scored.reduce((s, a) => s + a.health.lwSpend, 0)
  const totalLwResults = scored.reduce((s, a) => s + a.health.lwResults, 0)
  const totalImpressions = activeAccounts.reduce((s, a) => s + a.impressions, 0)
  const totalClicks = activeAccounts.reduce((s, a) => s + a.clicks, 0)

  const nonEcom = scored.filter(a => !isEcomActionType(a.primary_action_type))
  const nonEcomTwSpend = nonEcom.reduce((s, a) => s + a.health.twSpend, 0)
  const nonEcomTwResults = nonEcom.reduce((s, a) => s + a.health.twResults, 0)
  const nonEcomLwSpend = nonEcom.reduce((s, a) => s + a.health.lwSpend, 0)
  const nonEcomLwResults = nonEcom.reduce((s, a) => s + a.health.lwResults, 0)
  const twCPR = nonEcomTwResults > 0 ? nonEcomTwSpend / nonEcomTwResults : 0
  const lwCPR = nonEcomLwResults > 0 ? nonEcomLwSpend / nonEcomLwResults : 0

  const withTarget = scored.filter(a => a.target_cpl)
  const onTarget = withTarget.filter(a => a.health.vsTgt !== null && a.health.vsTgt <= 0)

  return (
    <>
      <Nav current="dashboard" />
      <PageWrapper>
        <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[22px] font-semibold text-[#111113] tracking-tight">Health Tracker</h2>
              <p className="text-[13px] text-[#9d9da8] mt-0.5">Last 7 days vs prior 7 — sorted by health score</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5"><StatusDot status="critical" /> {critical.length} Critical</span>
                <span className="flex items-center gap-1.5"><StatusDot status="warning" /> {warning.length} Warning</span>
                <span className="flex items-center gap-1.5"><StatusDot status="healthy" /> {healthy.length} Healthy</span>
              </div>
            </div>
          </div>

          {/* Agency KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1.5">Weekly Spend</p>
              <p className="text-[22px] font-semibold tabular-nums text-[#111113] tracking-tight">{formatCurrency(totalTwSpend)}</p>
              <WowArrow value={totalLwSpend > 0 ? ((totalTwSpend - totalLwSpend) / totalLwSpend) * 100 : 0} />
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1.5">Weekly Results</p>
              <p className="text-[22px] font-semibold tabular-nums text-[#111113] tracking-tight">{formatNumber(totalTwResults)}</p>
              <WowArrow value={totalLwResults > 0 ? ((totalTwResults - totalLwResults) / totalLwResults) * 100 : 0} />
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1.5">Blended CPR</p>
              <p className="text-[22px] font-semibold tabular-nums text-[#111113] tracking-tight">{twCPR > 0 ? formatCurrency(twCPR) : '—'}</p>
              <WowArrow value={lwCPR > 0 && twCPR > 0 ? ((twCPR - lwCPR) / lwCPR) * 100 : 0} invert />
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1.5">On Target</p>
              <p className="text-[22px] font-semibold tabular-nums text-[#111113] tracking-tight">{onTarget.length}/{withTarget.length}</p>
              <span className="text-[10px] text-[#9d9da8]">accounts</span>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1.5">Avg Health</p>
              <p className="text-[22px] font-semibold tabular-nums text-[#111113] tracking-tight">
                {scored.length > 0 ? Math.round(scored.reduce((s, a) => s + a.health.score, 0) / scored.length) : '—'}
              </p>
              <span className="text-[10px] text-[#9d9da8]">/ 100</span>
            </Card>
          </div>

          {/* Needs Attention Section */}
          {(critical.length > 0 || warning.length > 0) && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[13px] font-semibold text-[#111113]">Needs Attention</h3>
                <span className="text-[11px] text-[#9d9da8]">{critical.length + warning.length} accounts</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[...critical, ...warning].map(a => {
                  const h = a.health
                  const issues: React.ReactNode[] = []
                  if (h.vsTgt !== null && h.vsTgt > 25) issues.push(<IssueTag key="tgt">CPR +{h.vsTgt.toFixed(0)}% over target</IssueTag>)
                  else if (h.vsTgt !== null && h.vsTgt > 0) issues.push(<WarningTag key="tgt">CPR +{h.vsTgt.toFixed(0)}% over target</WarningTag>)
                  if (h.cprWow > 30) issues.push(<IssueTag key="wow">CPR up {h.cprWow.toFixed(0)}% WoW</IssueTag>)
                  else if (h.cprWow > 15) issues.push(<WarningTag key="wow">CPR up {h.cprWow.toFixed(0)}% WoW</WarningTag>)
                  if (h.zeroResultDays >= 2) issues.push(<IssueTag key="zero">{h.zeroResultDays} days with zero results</IssueTag>)
                  if (h.twResults === 0 && h.twSpend > 50) issues.push(<IssueTag key="noresults">Spending with no results</IssueTag>)
                  if (h.activeDays < 5) issues.push(<WarningTag key="active">Only {h.activeDays}/7 active days</WarningTag>)

                  return (
                    <Link key={a.ad_account_id} href={`/clients/${a.client_slug}`}>
                      <Card className={`p-4 hover:shadow-md transition-all duration-200 cursor-pointer ${h.status === 'critical' ? 'border-[#fecaca] bg-[#fffbfb]' : 'border-[#fde68a] bg-[#fffdf5]'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <StatusDot status={h.status} />
                            <span className="text-[13px] font-semibold text-[#111113]">{a.client_name}</span>
                          </div>
                          <HealthBar score={h.score} />
                        </div>

                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div>
                            <p className="text-[9px] text-[#9d9da8] uppercase tracking-wider">Spend</p>
                            <p className="text-[13px] font-semibold tabular-nums">{formatCurrency(h.twSpend)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-[#9d9da8] uppercase tracking-wider">Results</p>
                            <p className="text-[13px] font-semibold tabular-nums">{formatNumber(h.twResults)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-[#9d9da8] uppercase tracking-wider">CPR</p>
                            <p className={`text-[13px] font-semibold tabular-nums ${h.vsTgt !== null && h.vsTgt > 0 ? 'text-[#dc2626]' : ''}`}>
                              {h.cpr > 0 ? formatCurrency(h.cpr) : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] text-[#9d9da8] uppercase tracking-wider">Target</p>
                            <p className="text-[13px] tabular-nums text-[#9d9da8]">{a.target_cpl ? formatCurrency(a.target_cpl) : '—'}</p>
                          </div>
                        </div>

                        {issues.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {issues}
                          </div>
                        )}
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Full Account Table */}
          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec] flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#111113]">All Accounts</h3>
              <span className="text-[12px] text-[#9d9da8]">{activeAccounts.length} active of {accounts.length}</span>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#e8e8ec] bg-[#fafafb]">
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-left uppercase tracking-wider sticky left-0 bg-[#fafafb] z-10 min-w-[180px]">Client</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-center uppercase tracking-wider w-[70px]">Health</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Spend</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Results</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPR</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Target</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">vs Target</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPR WoW</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CTR</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPC</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Conv Rate</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider w-[100px]">7d Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {scored.map((a, idx) => {
                    const h = a.health
                    const rowBg = h.status === 'critical' ? 'bg-[#fef2f2]/40' : h.status === 'warning' ? 'bg-[#fffbeb]/40' : idx % 2 === 1 ? 'bg-[#fafafb]/50' : ''
                    return (
                      <tr key={a.ad_account_id} className={`border-b border-[#f4f4f6] hover:bg-[#f8f9fc] transition-colors group ${rowBg}`}>
                        <td className="py-3 px-4 sticky left-0 bg-white z-10">
                          <div className="flex items-center gap-2">
                            <StatusDot status={h.status} />
                            <div>
                              <Link href={`/clients/${a.client_slug}`} className="font-medium text-[#111113] group-hover:text-[#2563eb] transition-colors text-[12px]">{a.client_name}</Link>
                              <p className="text-[10px] text-[#9d9da8]">{a.result_label}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <HealthBar score={h.score} />
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium">{formatCurrency(h.twSpend)}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{formatNumber(h.twResults)}</td>
                        <td className={`py-3 px-4 text-right tabular-nums font-semibold ${h.status === 'critical' ? 'text-[#dc2626]' : h.status === 'warning' ? 'text-[#92400e]' : h.cpr > 0 ? 'text-[#16a34a]' : 'text-[#9d9da8]'}`}>
                          {h.cpr > 0 ? formatCurrency(h.cpr) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{a.target_cpl ? formatCurrency(a.target_cpl) : '—'}</td>
                        <td className={`py-3 px-4 text-right tabular-nums font-medium ${h.vsTgt !== null ? (h.vsTgt > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]') : 'text-[#9d9da8]'}`}>
                          {h.vsTgt !== null ? `${h.vsTgt > 0 ? '+' : ''}${h.vsTgt.toFixed(0)}%` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <WowArrow value={h.cprWow} invert />
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{h.ctr > 0 ? formatPercent(h.ctr) : '—'}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{h.cpc > 0 ? formatCurrency(h.cpc) : '—'}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{h.convRate > 0 ? formatPercent(h.convRate) : '—'}</td>
                        <td className="py-3 px-4">
                          <MiniBar data={h.tw7.map((d: any) => d.spend)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#e8e8ec] bg-[#fafafb] font-semibold text-[12px]">
                    <td className="py-3 px-4 sticky left-0 bg-[#fafafb] z-10" colSpan={2}>Totals ({activeAccounts.length})</td>
                    <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(totalTwSpend)}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{formatNumber(totalTwResults)}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{totalTwResults > 0 ? formatCurrency(totalTwSpend / totalTwResults) : '—'}</td>
                    <td className="py-3 px-4 text-right text-[#9d9da8]">—</td>
                    <td className="py-3 px-4 text-right text-[#9d9da8]">—</td>
                    <td className="py-3 px-4 text-right text-[#9d9da8]">—</td>
                    <td className="py-3 px-4 text-right tabular-nums">{totalImpressions > 0 ? formatPercent((totalClicks / totalImpressions) * 100) : '—'}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{totalClicks > 0 ? formatCurrency(totalTwSpend / totalClicks) : '—'}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{totalClicks > 0 ? formatPercent((totalTwResults / totalClicks) * 100) : '—'}</td>
                    <td className="py-3 px-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      </PageWrapper>
    </>
  )
}
