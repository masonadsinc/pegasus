import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { Nav, PageWrapper } from '@/components/nav'
import { CreativeStudioUI } from './creative-studio-ui'

export const revalidate = 0
const ORG_ID = process.env.ADSINC_ORG_ID!

export default async function CreativeStudioPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug, ad_accounts(id, is_active, primary_action_type)')
    .eq('org_id', ORG_ID)
    .order('name')

  const activeClients = (clients || []).filter(c =>
    (c.ad_accounts as any[])?.some((a: any) => a.is_active)
  )

  return (
    <>
      <Nav current="creative-studio" />
      <PageWrapper>
        <CreativeStudioUI clients={activeClients} initialClientId={params.client} />
      </PageWrapper>
    </>
  )
}
