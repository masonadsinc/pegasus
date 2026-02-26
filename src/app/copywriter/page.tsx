import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { Nav, PageWrapper } from '@/components/nav'
import { CopywriterUI } from './copywriter-ui'
import { getOrgId } from '@/lib/org'

export const revalidate = 0
const ORG_ID = await getOrgId()

export default async function CopywriterPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
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
      <Nav current="copywriter" />
      <PageWrapper>
        <CopywriterUI clients={activeClients} initialClientId={params.client} />
      </PageWrapper>
    </>
  )
}
