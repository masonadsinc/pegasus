import { Nav, PageWrapper } from '@/components/nav'
import { supabaseAdmin } from '@/lib/supabase'
import { ReportsHub } from './reports-hub'

const ORG_ID = process.env.ADSINC_ORG_ID!
export const revalidate = 0

async function getData() {
  const [clientsRes, reportsRes, orgRes] = await Promise.all([
    supabaseAdmin
      .from('clients')
      .select('id, name, slug, industry, status, ad_accounts(id, is_active)')
      .eq('org_id', ORG_ID)
      .eq('status', 'active')
      .order('name'),
    supabaseAdmin
      .from('weekly_reports')
      .select('*')
      .eq('org_id', ORG_ID)
      .order('period_end', { ascending: false })
      .order('client_name')
      .limit(500),
    supabaseAdmin
      .from('organizations')
      .select('report_day, report_time, report_auto_generate, report_default_days, timezone')
      .eq('id', ORG_ID)
      .single(),
  ])

  const activeClients = (clientsRes.data || []).filter(c =>
    (c.ad_accounts as any[])?.some((a: any) => a.is_active)
  ).map(c => ({ id: c.id, name: c.name, slug: c.slug, industry: c.industry }))

  return {
    activeClients,
    reports: reportsRes.data || [],
    reportSettings: {
      report_day: orgRes.data?.report_day ?? 1,
      report_time: orgRes.data?.report_time ?? '08:00',
      report_auto_generate: orgRes.data?.report_auto_generate ?? false,
      report_default_days: orgRes.data?.report_default_days ?? 7,
      report_timezone: orgRes.data?.timezone ?? 'America/Los_Angeles',
    },
  }
}

export default async function ReportsPage() {
  const { activeClients, reports, reportSettings } = await getData()

  return (
    <>
      <Nav current="reports" />
      <PageWrapper>
        <ReportsHub
          activeClients={activeClients}
          initialReports={reports}
          reportSettings={reportSettings}
        />
      </PageWrapper>
    </>
  )
}
