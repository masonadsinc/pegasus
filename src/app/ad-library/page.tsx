import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { Nav, PageWrapper } from '@/components/nav'
import { AdLibraryUI } from './ad-library-ui'

export const revalidate = 0
const ORG_ID = process.env.ADSINC_ORG_ID!

export default async function AdLibraryPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug')
    .eq('org_id', ORG_ID)
    .order('name')

  return (
    <>
      <Nav current="ad-library" />
      <PageWrapper>
        <AdLibraryUI clients={clients || []} initialClientId={params.client} />
      </PageWrapper>
    </>
  )
}
