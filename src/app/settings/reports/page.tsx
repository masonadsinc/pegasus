import { Nav, PageWrapper } from '@/components/nav'
import { supabaseAdmin } from '@/lib/supabase'
import { ReportSettingsForm } from './report-settings-form'
import { getOrgId } from '@/lib/org'

const ORG_ID = await getOrgId()
export const revalidate = 0

async function getData() {
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('report_day, report_time, report_auto_generate, report_default_days, timezone')
    .eq('id', ORG_ID)
    .single()

  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug, ad_accounts(id, is_active)')
    .eq('org_id', ORG_ID)
    .eq('status', 'active')
    .order('name')

  const activeClients = (clients || []).filter(c =>
    (c.ad_accounts as any[])?.some((a: any) => a.is_active)
  ).map(c => ({ id: c.id, name: c.name }))

  const { data: overrides } = await supabaseAdmin
    .from('report_schedules')
    .select('*')
    .eq('org_id', ORG_ID)

  return {
    settings: {
      report_day: org?.report_day ?? 1,
      report_time: org?.report_time ?? '08:00',
      report_auto_generate: org?.report_auto_generate ?? false,
      report_default_days: org?.report_default_days ?? 7,
      report_timezone: org?.timezone ?? 'America/Los_Angeles',
    },
    clients: activeClients,
    overrides: overrides || [],
  }
}

export default async function ReportSettingsPage() {
  const { settings, clients, overrides } = await getData()

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <ReportSettingsForm
          initialSettings={settings}
          clients={clients}
          initialOverrides={overrides}
        />
      </PageWrapper>
    </>
  )
}
