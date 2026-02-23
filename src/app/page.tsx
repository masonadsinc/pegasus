import { getDashboardData } from '@/lib/queries'
import { formatCurrency, formatNumber, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 300

export default async function Dashboard() {
  const accounts = await getDashboardData(ORG_ID, 7)

  const totalSpend = accounts.reduce((s, a) => s + a.spend, 0)
  const totalResults = accounts.reduce((s, a) => s + a.results, 0)
  const totalImpressions = accounts.reduce((s, a) => s + a.impressions, 0)
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
          <h1 className="text-xl font-bold text-[#1d1d1f] mb-1">Health Tracker</h1>
          <p className="text-[13px] text-[#86868b] mb-6">Agency overview · Last 7 days</p>

          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-5">
              <p className="text-[11px] text-[#86868b] uppercase tracking-wider mb-1">Total Spend</p>
              <p className="text-[28px] font-bold tabular-nums">{formatCurrency(totalSpend)}</p>
              <p className="text-[12px] text-[#86868b]">{formatCurrency(totalSpend / 7)}/day</p>
            </Card>
            <Card className="p-5">
              <p className="text-[11px] text-[#86868b] uppercase tracking-wider mb-1">Total Results</p>
              <p className="text-[28px] font-bold tabular-nums">{formatNumber(totalResults)}</p>
              <p className="text-[12px] text-[#86868b]">{(totalResults / 7).toFixed(0)}/day</p>
            </Card>
            <Card className="p-5">
              <p className="text-[11px] text-[#86868b] uppercase tracking-wider mb-1">Blended CPR</p>
              <p className="text-[28px] font-bold tabular-nums">{blendedCPR > 0 ? formatCurrency(blendedCPR) : '—'}</p>
              <p className="text-[12px] text-[#86868b]">Non-ecom accounts</p>
            </Card>
            <Card className="p-5">
              <p className="text-[11px] text-[#86868b] uppercase tracking-wider mb-1">Active Accounts</p>
              <p className="text-[28px] font-bold tabular-nums">{activeAccounts.length}</p>
              <p className="text-[12px] text-[#86868b]">{accounts.length} total</p>
            </Card>
          </div>

          {/* Account List */}
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold mb-4">All Accounts</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#e5e5e5]">
                    <th className="py-2 px-3 text-[11px] text-[#86868b] font-medium text-left uppercase tracking-wider">Client</th>
                    <th className="py-2 px-3 text-[11px] text-[#86868b] font-medium text-right uppercase tracking-wider">Spend</th>
                    <th className="py-2 px-3 text-[11px] text-[#86868b] font-medium text-right uppercase tracking-wider">Results</th>
                    <th className="py-2 px-3 text-[11px] text-[#86868b] font-medium text-right uppercase tracking-wider">CPR</th>
                    <th className="py-2 px-3 text-[11px] text-[#86868b] font-medium text-right uppercase tracking-wider">Impressions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAccounts.map(a => {
                    const cpr = a.results > 0 ? a.spend / a.results : 0
                    const isOver = a.target_cpl ? cpr > a.target_cpl : false
                    return (
                      <tr key={a.ad_account_id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                        <td className="py-2.5 px-3">
                          <a href={`/clients/${a.client_slug}`} className="font-medium text-[#007aff] hover:underline">{a.client_name}</a>
                          <p className="text-[11px] text-[#86868b]">{a.result_label}</p>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-medium">{formatCurrency(a.spend)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(a.results)}</td>
                        <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${isOver ? 'text-[#ff3b30]' : cpr > 0 ? 'text-[#34c759]' : 'text-[#aeaeb2]'}`}>
                          {cpr > 0 ? formatCurrency(cpr) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-[#86868b]">{formatNumber(a.impressions)}</td>
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
