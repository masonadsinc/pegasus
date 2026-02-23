import { getDashboardData } from '@/lib/queries'
import { formatCurrency, formatNumber, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 300

function MiniBar({ data, color = '#2563eb' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-[2px] h-[28px]">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max((v / max) * 100, 6)}%`, backgroundColor: color, opacity: 0.5 }} />
      ))}
    </div>
  )
}

export default async function Dashboard() {
  const accounts = await getDashboardData(ORG_ID, 7)

  const totalSpend = accounts.reduce((s, a) => s + a.spend, 0)
  const totalResults = accounts.reduce((s, a) => s + a.results, 0)
  const activeAccounts = accounts.filter(a => a.spend > 0)

  const nonEcom = activeAccounts.filter(a => !isEcomActionType(a.primary_action_type))
  const nonEcomSpend = nonEcom.reduce((s, a) => s + a.spend, 0)
  const nonEcomResults = nonEcom.reduce((s, a) => s + a.results, 0)
  const blendedCPR = nonEcomResults > 0 ? nonEcomSpend / nonEcomResults : 0

  return (
    <>
      <Nav current="dashboard" />
      <PageWrapper>
        <div className="p-6 max-w-[1200px] mx-auto">
          <h2 className="text-xl font-bold text-[#111113] mb-1">Health Tracker</h2>
          <p className="text-[13px] text-[#9d9da8] mb-6">Agency overview — last 7 days</p>

          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-5">
              <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Total Spend</p>
              <p className="text-[28px] font-bold tabular-nums text-[#111113]">{formatCurrency(totalSpend)}</p>
              <p className="text-[12px] text-[#9d9da8]">{formatCurrency(totalSpend / 7)} / day</p>
            </Card>
            <Card className="p-5">
              <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Total Results</p>
              <p className="text-[28px] font-bold tabular-nums text-[#111113]">{formatNumber(totalResults)}</p>
              <p className="text-[12px] text-[#9d9da8]">{(totalResults / 7).toFixed(0)} / day</p>
            </Card>
            <Card className="p-5">
              <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Blended CPR</p>
              <p className="text-[28px] font-bold tabular-nums text-[#111113]">{blendedCPR > 0 ? formatCurrency(blendedCPR) : '—'}</p>
              <p className="text-[12px] text-[#9d9da8]">Non-ecom accounts</p>
            </Card>
            <Card className="p-5">
              <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Active Accounts</p>
              <p className="text-[28px] font-bold tabular-nums text-[#111113]">{activeAccounts.length}</p>
              <p className="text-[12px] text-[#9d9da8]">{accounts.length} total</p>
            </Card>
          </div>

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
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Impressions</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider w-[100px]">7d</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAccounts.map(a => {
                    const cpr = a.results > 0 ? a.spend / a.results : 0
                    const isOver = a.target_cpl ? cpr > a.target_cpl : false
                    return (
                      <tr key={a.ad_account_id} className="border-b border-[#f4f4f6] hover:bg-[#fafafb] transition-colors">
                        <td className="py-3 px-5">
                          <Link href={`/clients/${a.client_slug}`} className="font-medium text-[#2563eb] hover:underline">{a.client_name}</Link>
                          <p className="text-[11px] text-[#9d9da8] mt-0.5">{a.result_label}</p>
                        </td>
                        <td className="py-3 px-5 text-right tabular-nums font-medium">{formatCurrency(a.spend)}</td>
                        <td className="py-3 px-5 text-right tabular-nums text-[#6b6b76]">{formatNumber(a.results)}</td>
                        <td className={`py-3 px-5 text-right tabular-nums font-semibold ${isOver ? 'text-[#dc2626]' : cpr > 0 ? 'text-[#16a34a]' : 'text-[#9d9da8]'}`}>
                          {cpr > 0 ? formatCurrency(cpr) : '—'}
                        </td>
                        <td className="py-3 px-5 text-right tabular-nums text-[#9d9da8]">{formatNumber(a.impressions)}</td>
                        <td className="py-3 px-5">
                          <MiniBar data={a.daily.slice(-7).map(d => d.spend)} />
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
