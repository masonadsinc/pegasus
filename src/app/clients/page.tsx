import { getDashboardData, AccountSummary } from '@/lib/queries'
import { formatCurrency, formatNumber, isEcomActionType } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export const revalidate = 300
const ORG_ID = process.env.ADSINC_ORG_ID!

type Status = 'on-target' | 'over' | 'critical' | 'no-data'

function getStatus(a: AccountSummary): Status {
  if (a.spend === 0) return 'no-data'
  const isEcom = isEcomActionType(a.primary_action_type)
  if (isEcom) {
    const roas = a.spend > 0 ? a.purchase_value / a.spend : 0
    if (!a.target_roas) return 'no-data'
    return roas >= a.target_roas ? 'on-target' : roas >= a.target_roas * 0.75 ? 'over' : 'critical'
  }
  const cpr = a.results > 0 ? a.spend / a.results : 0
  if (!a.target_cpl || cpr === 0) return 'no-data'
  return cpr <= a.target_cpl ? 'on-target' : cpr <= a.target_cpl * 1.25 ? 'over' : 'critical'
}

const statusConfig: Record<Status, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  'on-target': { label: 'On Target', variant: 'success' },
  'over': { label: 'Over Target', variant: 'warning' },
  'critical': { label: 'Critical', variant: 'danger' },
  'no-data': { label: 'No Target', variant: 'neutral' },
}

function SparkLine({ daily }: { daily: AccountSummary['daily'] }) {
  const data = daily.slice(-14).map(d => d.spend)
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 100
  const h = 28
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)

  return (
    <svg width={w} height={h}>
      <polyline points={points.join(' ')} fill="none" stroke="#2563eb" strokeWidth="1.5" opacity="0.5" />
    </svg>
  )
}

export default async function ClientsPage() {
  const accounts = await getDashboardData(ORG_ID, 14)

  const statusOrder: Record<Status, number> = { critical: 0, over: 1, 'on-target': 2, 'no-data': 3 }
  const sorted = [...accounts].sort((a, b) => {
    const sa = statusOrder[getStatus(a)]
    const sb = statusOrder[getStatus(b)]
    if (sa !== sb) return sa - sb
    return b.spend - a.spend
  })

  const active = sorted.filter(a => a.spend > 0)
  const inactive = sorted.filter(a => a.spend === 0)

  const onTarget = active.filter(a => getStatus(a) === 'on-target').length
  const over = active.filter(a => getStatus(a) === 'over').length
  const critical = active.filter(a => getStatus(a) === 'critical').length

  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-6 max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#111113]">Clients</h2>
              <p className="text-[13px] text-[#9d9da8]">All client accounts — last 7 days</p>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-[#6b6b76]">
              {critical > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#dc2626]" />{critical} critical</span>}
              {over > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#ea580c]" />{over} over target</span>}
              {onTarget > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#16a34a]" />{onTarget} on target</span>}
            </div>
          </div>

          <Card>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#e8e8ec]">
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Client</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider w-[100px]">14d Trend</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Spend</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Results</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPR</th>
                    <th className="py-3 px-5 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map(a => {
                    const status = getStatus(a)
                    const cfg = statusConfig[status]
                    const isEcom = isEcomActionType(a.primary_action_type)
                    const cpr = a.results > 0 ? a.spend / a.results : 0
                    const roas = a.spend > 0 ? a.purchase_value / a.spend : 0

                    return (
                      <tr key={a.ad_account_id} className="border-b border-[#f4f4f6] hover:bg-[#fafafb] transition-colors">
                        <td className="py-3 px-5">
                          <Link href={`/clients/${a.client_slug}`} className="font-medium text-[#2563eb] hover:underline">{a.client_name}</Link>
                          <p className="text-[11px] text-[#9d9da8] mt-0.5">{a.result_label}</p>
                        </td>
                        <td className="py-3 px-5 text-right"><SparkLine daily={a.daily} /></td>
                        <td className="py-3 px-5 text-right tabular-nums font-medium">{formatCurrency(a.spend)}</td>
                        <td className="py-3 px-5 text-right tabular-nums text-[#6b6b76]">{formatNumber(a.results)}</td>
                        <td className={`py-3 px-5 text-right tabular-nums font-semibold ${
                          status === 'on-target' ? 'text-[#16a34a]' :
                          status === 'critical' ? 'text-[#dc2626]' :
                          status === 'over' ? 'text-[#ea580c]' : 'text-[#9d9da8]'
                        }`}>
                          {isEcom ? (roas > 0 ? `${roas.toFixed(2)}x` : '—') : (cpr > 0 ? formatCurrency(cpr) : '—')}
                        </td>
                        <td className="py-3 px-5"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {inactive.length > 0 && (
            <Card className="mt-6">
              <div className="px-5 py-3 border-b border-[#e8e8ec]">
                <h3 className="text-[13px] font-medium text-[#9d9da8]">Inactive ({inactive.length})</h3>
              </div>
              {inactive.map(a => (
                <div key={a.ad_account_id} className="flex items-center justify-between px-5 py-2.5 border-b border-[#f4f4f6] last:border-0">
                  <span className="text-[13px] text-[#9d9da8]">{a.client_name}</span>
                  <span className="text-[11px] text-[#c4c4cc]">No spend</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </PageWrapper>
    </>
  )
}
