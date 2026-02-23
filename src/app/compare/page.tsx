import { getDashboardData } from '@/lib/queries'
import { formatCurrency, formatNumber, formatPercent, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 300

export default async function ComparePage() {
  const accounts = await getDashboardData(ORG_ID, 7)
  const activeAccounts = accounts.filter(a => a.spend > 0)

  return (
    <>
      <Nav current="compare" />
      <PageWrapper>
        <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">
          <div className="mb-6">
            <h2 className="text-[22px] font-semibold text-[#111113] tracking-tight">Client Comparison</h2>
            <p className="text-[13px] text-[#9d9da8] mt-0.5">Side-by-side performance metrics across all active accounts</p>
          </div>

          <Card>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#e8e8ec] bg-[#fafafb]">
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-left uppercase tracking-wider sticky left-0 bg-[#fafafb] z-10 min-w-[160px]">Client</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Spend</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Results</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPR</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Target</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">vs Target</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Impr</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Clicks</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CTR</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPC</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPM</th>
                    <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Conv Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAccounts.sort((a, b) => b.spend - a.spend).map((a, idx) => {
                    const cpr = a.results > 0 ? a.spend / a.results : 0
                    const isOver = a.target_cpl && cpr > a.target_cpl
                    const ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0
                    const cpc = a.clicks > 0 ? a.spend / a.clicks : 0
                    const cpm = a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0
                    const convRate = a.clicks > 0 ? (a.results / a.clicks) * 100 : 0
                    const vsTgt = a.target_cpl && cpr > 0 ? ((cpr / a.target_cpl - 1) * 100) : null
                    return (
                      <tr key={a.ad_account_id} className={`border-b border-[#f4f4f6] hover:bg-[#f8f9fc] transition-colors ${idx % 2 === 1 ? 'bg-[#fafafb]/50' : ''}`}>
                        <td className="py-3 px-4 sticky left-0 bg-white z-10">
                          <Link href={`/clients/${a.client_slug}`} className="font-medium text-[#111113] hover:text-[#2563eb] transition-colors">{a.client_name}</Link>
                          <p className="text-[10px] text-[#9d9da8]">{a.result_label}</p>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium">{formatCurrency(a.spend)}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{formatNumber(a.results)}</td>
                        <td className={`py-3 px-4 text-right tabular-nums font-semibold ${isOver ? 'text-[#dc2626]' : cpr > 0 ? 'text-[#16a34a]' : 'text-[#9d9da8]'}`}>
                          {cpr > 0 ? formatCurrency(cpr) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{a.target_cpl ? formatCurrency(a.target_cpl) : '—'}</td>
                        <td className={`py-3 px-4 text-right tabular-nums font-medium ${vsTgt !== null ? (vsTgt > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]') : 'text-[#9d9da8]'}`}>
                          {vsTgt !== null ? `${vsTgt > 0 ? '+' : ''}${vsTgt.toFixed(0)}%` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{formatNumber(a.impressions)}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{formatNumber(a.clicks)}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{ctr > 0 ? formatPercent(ctr) : '—'}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{cpc > 0 ? formatCurrency(cpc) : '—'}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{cpm > 0 ? formatCurrency(cpm) : '—'}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{convRate > 0 ? formatPercent(convRate) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#e8e8ec] bg-[#fafafb] font-semibold">
                    <td className="py-3 px-4 sticky left-0 bg-[#fafafb] z-10">Totals ({activeAccounts.length} accounts)</td>
                    <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(activeAccounts.reduce((s, a) => s + a.spend, 0))}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{formatNumber(activeAccounts.reduce((s, a) => s + a.results, 0))}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{activeAccounts.reduce((s, a) => s + a.results, 0) > 0 ? formatCurrency(activeAccounts.reduce((s, a) => s + a.spend, 0) / activeAccounts.reduce((s, a) => s + a.results, 0)) : '—'}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">—</td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">—</td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{formatNumber(activeAccounts.reduce((s, a) => s + a.impressions, 0))}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{formatNumber(activeAccounts.reduce((s, a) => s + a.clicks, 0))}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{(() => { const imp = activeAccounts.reduce((s, a) => s + a.impressions, 0); const cl = activeAccounts.reduce((s, a) => s + a.clicks, 0); return imp > 0 ? formatPercent((cl / imp) * 100) : '—' })()}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">—</td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">—</td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">—</td>
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
