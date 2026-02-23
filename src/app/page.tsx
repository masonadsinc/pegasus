import { getDashboardData } from '@/lib/queries'
import { formatCurrency, formatNumber, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 300

function MiniBar({ data, color = 'bg-blue-500' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-[2px] h-[32px]">
      {data.map((v, i) => (
        <div key={i} className={`flex-1 ${color} rounded-sm opacity-60`} style={{ height: `${Math.max((v / max) * 100, 4)}%` }} />
      ))}
    </div>
  )
}

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
        <div className="p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
            <p className="text-sm text-zinc-500 mt-1">Agency performance overview — last 7 days</p>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-5">
              <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2">Total Spend</p>
              <p className="text-[28px] font-semibold tabular-nums text-white">{formatCurrency(totalSpend)}</p>
              <p className="text-[12px] text-zinc-500 mt-1">{formatCurrency(totalSpend / 7)} / day avg</p>
            </Card>
            <Card className="p-5">
              <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2">Total Results</p>
              <p className="text-[28px] font-semibold tabular-nums text-white">{formatNumber(totalResults)}</p>
              <p className="text-[12px] text-zinc-500 mt-1">{(totalResults / 7).toFixed(0)} / day avg</p>
            </Card>
            <Card className="p-5">
              <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2">Blended CPR</p>
              <p className="text-[28px] font-semibold tabular-nums text-white">{blendedCPR > 0 ? formatCurrency(blendedCPR) : '—'}</p>
              <p className="text-[12px] text-zinc-500 mt-1">Non-ecom accounts</p>
            </Card>
            <Card className="p-5">
              <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2">Active Accounts</p>
              <p className="text-[28px] font-semibold tabular-nums text-white">{activeAccounts.length}</p>
              <p className="text-[12px] text-zinc-500 mt-1">{accounts.length} total</p>
            </Card>
          </div>

          {/* Account Table */}
          <Card>
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-medium text-white">All Accounts</h2>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    <th className="py-3 px-5 text-[11px] text-zinc-500 font-medium text-left uppercase tracking-wider">Client</th>
                    <th className="py-3 px-5 text-[11px] text-zinc-500 font-medium text-right uppercase tracking-wider">Spend</th>
                    <th className="py-3 px-5 text-[11px] text-zinc-500 font-medium text-right uppercase tracking-wider">Results</th>
                    <th className="py-3 px-5 text-[11px] text-zinc-500 font-medium text-right uppercase tracking-wider">CPR</th>
                    <th className="py-3 px-5 text-[11px] text-zinc-500 font-medium text-right uppercase tracking-wider">Impressions</th>
                    <th className="py-3 px-5 text-[11px] text-zinc-500 font-medium text-right uppercase tracking-wider w-[120px]">7d Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAccounts.map(a => {
                    const cpr = a.results > 0 ? a.spend / a.results : 0
                    const isOver = a.target_cpl ? cpr > a.target_cpl : false
                    return (
                      <tr key={a.ad_account_id} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3.5 px-5">
                          <Link href={`/clients/${a.client_slug}`} className="font-medium text-white hover:text-blue-400 transition-colors">{a.client_name}</Link>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{a.result_label}</p>
                        </td>
                        <td className="py-3.5 px-5 text-right tabular-nums font-medium text-white">{formatCurrency(a.spend)}</td>
                        <td className="py-3.5 px-5 text-right tabular-nums text-zinc-300">{formatNumber(a.results)}</td>
                        <td className={`py-3.5 px-5 text-right tabular-nums font-semibold ${isOver ? 'text-red-400' : cpr > 0 ? 'text-emerald-400' : 'text-zinc-600'}`}>
                          {cpr > 0 ? formatCurrency(cpr) : '—'}
                        </td>
                        <td className="py-3.5 px-5 text-right tabular-nums text-zinc-400">{formatNumber(a.impressions)}</td>
                        <td className="py-3.5 px-5">
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
