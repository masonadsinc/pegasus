import { Nav, PageWrapper } from '@/components/nav'
import { getDashboardData } from '@/lib/queries'
import { PegasusChat } from './pegasus-chat'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 300

export default async function PegasusPage() {
  const accounts = await getDashboardData(ORG_ID, 7)
  const active = accounts.filter(a => a.spend > 0).sort((a, b) => b.spend - a.spend)

  const summary = {
    totalSpend: active.reduce((s, a) => s + a.spend, 0),
    totalResults: active.reduce((s, a) => s + a.results, 0),
    activeCount: active.length,
    criticalCount: active.filter(a => a.target_cpl && a.results > 0 && (a.spend / a.results) > a.target_cpl * 1.25).length,
    clients: active.map(a => ({
      name: a.client_name,
      slug: a.client_slug,
      spend: a.spend,
      results: a.results,
      cpr: a.results > 0 ? a.spend / a.results : 0,
      target: a.target_cpl,
      onTarget: a.target_cpl && a.results > 0 ? (a.spend / a.results) <= a.target_cpl : null,
    })),
  }

  return (
    <>
      <Nav current="pegasus" />
      <PageWrapper>
        <PegasusChat summary={summary} />
      </PageWrapper>
    </>
  )
}
