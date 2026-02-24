import { Nav, PageWrapper } from '@/components/nav'
import { supabaseAdmin } from '@/lib/supabase'
import { ReportsHub } from './reports-hub'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 0

async function getData() {
  // Get active clients with ad accounts
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug, industry, status, ad_accounts(id, is_active)')
    .eq('org_id', ORG_ID)
    .eq('status', 'active')
    .order('name')

  const activeClients = (clients || []).filter(c =>
    (c.ad_accounts as any[])?.some((a: any) => a.is_active)
  ).map(c => ({ id: c.id, name: c.name, slug: c.slug, industry: c.industry }))

  // Get all reports, most recent first
  const { data: reports } = await supabaseAdmin
    .from('weekly_reports')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('period_end', { ascending: false })
    .order('client_name')
    .limit(200)

  return { activeClients, reports: reports || [] }
}

export default async function ReportsPage() {
  const { activeClients, reports } = await getData()

  return (
    <>
      <Nav current="reports" />
      <PageWrapper>
        <ReportsHub
          activeClients={activeClients}
          initialReports={reports}
        />
      </PageWrapper>
    </>
  )
}
