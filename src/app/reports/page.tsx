import { getDashboardData } from '@/lib/queries'
import { formatCurrency, formatNumber, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 300

export default async function ReportsPage() {
  const accounts = await getDashboardData(ORG_ID, 7)
  const active = accounts.filter(a => a.spend > 0).sort((a, b) => b.spend - a.spend)

  const totalSpend = active.reduce((s, a) => s + a.spend, 0)
  const totalResults = active.reduce((s, a) => s + a.results, 0)

  return (
    <>
      <Nav current="reports" />
      <PageWrapper>
        <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">
          <div className="mb-6">
            <h2 className="text-[20px] font-semibold text-[#111113] tracking-tight">Reports</h2>
            <p className="text-[13px] text-[#9d9da8] mt-0.5">Export and download performance reports</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Active Accounts</p>
              <p className="text-[24px] font-semibold tabular-nums text-[#111113]">{active.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Weekly Spend</p>
              <p className="text-[24px] font-semibold tabular-nums text-[#111113]">{formatCurrency(totalSpend)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Weekly Results</p>
              <p className="text-[24px] font-semibold tabular-nums text-[#111113]">{formatNumber(totalResults)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Blended CPR</p>
              <p className="text-[24px] font-semibold tabular-nums text-[#111113]">{totalResults > 0 ? formatCurrency(totalSpend / totalResults) : '—'}</p>
            </Card>
          </div>

          {/* Export per Client */}
          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec] flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[#111113]">Client Reports</h3>
              <span className="text-[12px] text-[#9d9da8]">CSV exports</span>
            </div>
            <div className="divide-y divide-[#f4f4f6]">
              {active.map(a => {
                const cpr = a.results > 0 ? a.spend / a.results : 0
                const isEcom = isEcomActionType(a.primary_action_type)
                return (
                  <div key={a.ad_account_id} className="px-5 py-4 flex items-center justify-between hover:bg-[#fafafb] transition-colors">
                    <div className="flex items-center gap-4">
                      <div>
                        <Link href={`/clients/${a.client_slug}`} className="text-[13px] font-medium text-[#111113] hover:text-[#2563eb]">{a.client_name}</Link>
                        <p className="text-[11px] text-[#9d9da8]">{formatCurrency(a.spend)} spent · {formatNumber(a.results)} {a.result_label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`/api/export?account_id=${a.ad_account_id}&type=daily&days=7`}
                         className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors">
                        7d Daily
                      </a>
                      <a href={`/api/export?account_id=${a.ad_account_id}&type=daily&days=30`}
                         className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors">
                        30d Daily
                      </a>
                      <a href={`/api/export?account_id=${a.ad_account_id}&type=ads&days=30`}
                         className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors">
                        Ads
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Report Templates (Coming Soon) */}
          <div className="mt-8">
            <h3 className="text-[13px] font-semibold text-[#111113] mb-3">Report Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 opacity-60">
                <h4 className="text-[13px] font-semibold text-[#111113] mb-1">Weekly Summary</h4>
                <p className="text-[12px] text-[#9d9da8]">Auto-generated weekly performance summary for all clients. PDF export.</p>
                <span className="inline-block mt-3 text-[10px] font-medium text-[#9d9da8] bg-[#f4f4f6] px-2 py-1 rounded uppercase tracking-wider">Coming Soon</span>
              </Card>
              <Card className="p-5 opacity-60">
                <h4 className="text-[13px] font-semibold text-[#111113] mb-1">Monthly Client Report</h4>
                <p className="text-[12px] text-[#9d9da8]">White-labeled monthly report with charts, insights, and recommendations.</p>
                <span className="inline-block mt-3 text-[10px] font-medium text-[#9d9da8] bg-[#f4f4f6] px-2 py-1 rounded uppercase tracking-wider">Coming Soon</span>
              </Card>
              <Card className="p-5 opacity-60">
                <h4 className="text-[13px] font-semibold text-[#111113] mb-1">Scheduled Reports</h4>
                <p className="text-[12px] text-[#9d9da8]">Auto-email reports to clients on a schedule. Daily, weekly, or monthly.</p>
                <span className="inline-block mt-3 text-[10px] font-medium text-[#9d9da8] bg-[#f4f4f6] px-2 py-1 rounded uppercase tracking-wider">Coming Soon</span>
              </Card>
            </div>
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
