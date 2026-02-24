import { Nav, PageWrapper } from '@/components/nav'
import { supabaseAdmin } from '@/lib/supabase'
import { PegasusChat } from './pegasus-chat'
import { getDashboardData } from '@/lib/queries'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 300

async function getClients() {
  const [clientsRes, accounts] = await Promise.all([
    supabaseAdmin
      .from('clients')
      .select('id, name, slug, industry, location, status, ad_accounts(id, is_active)')
      .eq('org_id', ORG_ID)
      .order('name'),
    getDashboardData(ORG_ID, 7),
  ])

  const clients = clientsRes.data || []
  const spendMap = new Map(accounts.map(a => [a.client_slug, { spend: a.spend, results: a.results }]))

  return clients
    .filter(c => c.status === 'active' && (c.ad_accounts as any[])?.some((a: any) => a.is_active))
    .map(c => {
      const activity = spendMap.get(c.slug)
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        industry: c.industry,
        location: c.location,
        weeklySpend: activity?.spend || 0,
        weeklyResults: activity?.results || 0,
      }
    })
    .sort((a, b) => b.weeklySpend - a.weeklySpend) // Active spenders first
}

export default async function PegasusPage() {
  const clients = await getClients()

  return (
    <>
      <Nav current="pegasus" />
      <PageWrapper>
        <PegasusChat clients={clients} />
      </PageWrapper>
    </>
  )
}
