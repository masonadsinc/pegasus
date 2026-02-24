import { Nav, PageWrapper } from '@/components/nav'
import { supabaseAdmin } from '@/lib/supabase'
import { PegasusChat } from './pegasus-chat'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 300

async function getClients() {
  const { data } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug, industry, location, status, ad_accounts(id, is_active)')
    .eq('org_id', ORG_ID)
    .order('name')
  return (data || []).filter(c => 
    c.status === 'active' && (c.ad_accounts as any[])?.some((a: any) => a.is_active)
  ).map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    industry: c.industry,
    location: c.location,
  }))
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
