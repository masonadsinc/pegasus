import { Nav, PageWrapper } from '@/components/nav'
import { supabaseAdmin } from '@/lib/supabase'
import { ReportsHub } from './reports-hub'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 0 // Always fresh

async function getData() {
  // Get distinct weeks
  const { data: weekRows } = await supabaseAdmin
    .from('weekly_reports')
    .select('week')
    .eq('org_id', ORG_ID)
    .order('week', { ascending: false })
    .limit(200)

  const weeks = [...new Set((weekRows || []).map(w => w.week))]

  // Get active clients
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug, industry, status, ad_accounts(id, is_active)')
    .eq('org_id', ORG_ID)
    .eq('status', 'active')
    .order('name')

  const activeClients = (clients || []).filter(c =>
    (c.ad_accounts as any[])?.some((a: any) => a.is_active)
  ).map(c => ({ id: c.id, name: c.name, slug: c.slug, industry: c.industry }))

  // Get reports for latest week if any
  let latestReports: any[] = []
  if (weeks.length > 0) {
    const { data } = await supabaseAdmin
      .from('weekly_reports')
      .select('*')
      .eq('org_id', ORG_ID)
      .eq('week', weeks[0])
      .order('client_name')
    latestReports = data || []
  }

  return { weeks, activeClients, latestReports, latestWeek: weeks[0] || null }
}

export default async function ReportsPage() {
  const { weeks, activeClients, latestReports, latestWeek } = await getData()

  return (
    <>
      <Nav current="reports" />
      <PageWrapper>
        <ReportsHub
          weeks={weeks}
          activeClients={activeClients}
          initialReports={latestReports}
          initialWeek={latestWeek}
        />
      </PageWrapper>
    </>
  )
}
