import { getDashboardData } from '@/lib/queries'
import { formatCurrency, formatNumber, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { DataFreshness } from '@/components/data-freshness'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 300

async function getRevenueData() {
  const { data } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug, status, monthly_retainer, rev_share_pct')
    .eq('org_id', ORG_ID)
    .eq('status', 'active')
    .order('monthly_retainer', { ascending: false, nullsFirst: false })
  return data || []
}

export default async function ReportsPage() {
  const [accounts, clients] = await Promise.all([
    getDashboardData(ORG_ID, 7),
    getRevenueData(),
  ])
  const active = accounts.filter(a => a.spend > 0).sort((a, b) => b.spend - a.spend)

  const totalSpend = active.reduce((s, a) => s + a.spend, 0)
  const totalResults = active.reduce((s, a) => s + a.results, 0)
  const totalMRR = clients.reduce((s, c) => s + (c.monthly_retainer || 0), 0)
  const clientsWithRetainer = clients.filter(c => c.monthly_retainer)

  return (
    <>
      <Nav current="reports" />
      <PageWrapper>
        <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[20px] font-semibold text-[#111113] tracking-tight">Reports</h2>
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-[13px] text-[#9d9da8]">Export and review performance data</p>
                <DataFreshness />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href="/api/export-all?days=7" className="px-4 py-2 rounded bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] transition-colors flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" /></svg>
                Export All (7d)
              </a>
              <a href="/api/export-all?days=30" className="px-4 py-2 rounded border border-[#e8e8ec] text-[#6b6b76] text-[12px] font-medium hover:bg-[#f4f4f6] transition-colors">
                30d
              </a>
            </div>
          </div>

          {/* Agency Revenue + Performance */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Monthly Revenue</p>
              <p className="text-[24px] font-semibold tabular-nums text-[#111113]">{formatCurrency(totalMRR)}</p>
              <p className="text-[11px] text-[#9d9da8]">{clientsWithRetainer.length} paying clients</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Weekly Ad Spend</p>
              <p className="text-[24px] font-semibold tabular-nums text-[#111113]">{formatCurrency(totalSpend)}</p>
              <p className="text-[11px] text-[#9d9da8]">{active.length} active accounts</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Weekly Results</p>
              <p className="text-[24px] font-semibold tabular-nums text-[#111113]">{formatNumber(totalResults)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Blended CPR</p>
              <p className="text-[24px] font-semibold tabular-nums text-[#111113]">{totalResults > 0 ? formatCurrency(totalSpend / totalResults) : '—'}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider mb-1">Est. Annual Rev</p>
              <p className="text-[24px] font-semibold tabular-nums text-[#111113]">{formatCurrency(totalMRR * 12)}</p>
            </Card>
          </div>

          {/* Revenue Breakdown */}
          {clientsWithRetainer.length > 0 && (
            <Card className="mb-8">
              <div className="px-5 py-4 border-b border-[#e8e8ec]">
                <h3 className="text-[13px] font-semibold text-[#111113]">Revenue by Client</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#e8e8ec] bg-[#fafafb]">
                      <th className="py-3 px-5 text-[10px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Client</th>
                      <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Retainer</th>
                      <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Rev Share</th>
                      <th className="py-3 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">% of MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientsWithRetainer.map(c => (
                      <tr key={c.id} className="border-b border-[#f4f4f6] hover:bg-[#fafafb]">
                        <td className="py-3 px-5">
                          <Link href={`/clients/${c.slug}`} className="font-medium text-[#111113] hover:text-[#2563eb]">{c.name}</Link>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium">{formatCurrency(c.monthly_retainer)}/mo</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{c.rev_share_pct ? `${c.rev_share_pct}%` : '—'}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{totalMRR > 0 ? `${((c.monthly_retainer / totalMRR) * 100).toFixed(1)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#e8e8ec] bg-[#fafafb] font-semibold">
                      <td className="py-3 px-5">Total ({clientsWithRetainer.length} clients)</td>
                      <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(totalMRR)}/mo</td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          {/* Per-Client Exports */}
          <Card>
            <div className="px-5 py-4 border-b border-[#e8e8ec] flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[#111113]">Client Exports</h3>
              <span className="text-[12px] text-[#9d9da8]">CSV downloads</span>
            </div>
            <div className="divide-y divide-[#f4f4f6]">
              {active.map(a => (
                <div key={a.ad_account_id} className="px-5 py-3.5 flex items-center justify-between hover:bg-[#fafafb] transition-colors">
                  <div>
                    <Link href={`/clients/${a.client_slug}`} className="text-[12px] font-medium text-[#111113] hover:text-[#2563eb]">{a.client_name}</Link>
                    <p className="text-[11px] text-[#9d9da8]">{formatCurrency(a.spend)} spent · {formatNumber(a.results)} {a.result_label}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={`/api/export?account_id=${a.ad_account_id}&type=daily&days=7`}
                       className="px-2.5 py-1 rounded border border-[#e8e8ec] text-[10px] font-medium text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors">
                      7d
                    </a>
                    <a href={`/api/export?account_id=${a.ad_account_id}&type=daily&days=30`}
                       className="px-2.5 py-1 rounded border border-[#e8e8ec] text-[10px] font-medium text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors">
                      30d
                    </a>
                    <a href={`/api/export?account_id=${a.ad_account_id}&type=daily&days=90`}
                       className="px-2.5 py-1 rounded border border-[#e8e8ec] text-[10px] font-medium text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors">
                      90d
                    </a>
                    <a href={`/api/export?account_id=${a.ad_account_id}&type=ads&days=30`}
                       className="px-2.5 py-1 rounded border border-[#e8e8ec] text-[10px] font-medium text-[#6b6b76] hover:bg-[#f4f4f6] transition-colors">
                      Ads
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Coming Soon */}
          <div className="mt-8">
            <h3 className="text-[13px] font-semibold text-[#9d9da8] mb-3">Coming Soon</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'PDF Reports', desc: 'White-labeled performance reports with charts and insights' },
                { title: 'Scheduled Reports', desc: 'Auto-email reports to clients daily, weekly, or monthly' },
                { title: 'Custom Templates', desc: 'Build your own report templates with drag-and-drop' },
              ].map(item => (
                <Card key={item.title} className="p-5 opacity-50">
                  <h4 className="text-[13px] font-semibold text-[#111113] mb-1">{item.title}</h4>
                  <p className="text-[12px] text-[#9d9da8]">{item.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
