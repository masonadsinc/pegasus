import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 60
const ORG_ID = process.env.ADSINC_ORG_ID!

async function getOrgData() {
  const [orgRes, membersRes, clientsRes, accountsRes, syncRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('name, timezone, sync_enabled, sync_time, report_auto_generate, report_day, plan, gemini_api_key').eq('id', ORG_ID).single(),
    supabaseAdmin.from('org_members').select('id').eq('org_id', ORG_ID),
    supabaseAdmin.from('clients').select('id, status').eq('org_id', ORG_ID),
    supabaseAdmin.from('ad_accounts').select('id, is_active').eq('org_id', ORG_ID),
    supabaseAdmin.from('sync_logs').select('id, completed_at, status').eq('org_id', ORG_ID).order('completed_at', { ascending: false }).limit(1),
  ])

  const org = orgRes.data
  const activeClients = (clientsRes.data || []).filter(c => c.status === 'active').length
  const activeAccounts = (accountsRes.data || []).filter(a => a.is_active).length
  const lastSync = syncRes.data?.[0]
  const lastSyncTime = lastSync?.completed_at
    ? new Date(lastSync.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Never'
  const syncHealthy = lastSync?.status === 'success'
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return { org, activeClients, activeAccounts, lastSyncTime, syncHealthy, dayNames, members: membersRes.data || [] }
}

export default async function SettingsPage() {
  const { org, activeClients, activeAccounts, lastSyncTime, syncHealthy, dayNames, members } = await getOrgData()

  const sections = [
    {
      title: 'ORGANIZATION',
      cards: [
        {
          href: '/settings/agency',
          title: 'General',
          desc: 'Agency name, timezone, logo, and brand color',
          detail: org?.timezone?.replace('America/', '').replace('_', ' ') || 'Pacific',
          icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
        },
        {
          href: '/settings/team',
          title: 'Team',
          desc: 'Manage team members and roles',
          detail: `${members.length} member${members.length !== 1 ? 's' : ''}`,
          icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
        },
        {
          href: '/settings/clients',
          title: 'Clients',
          desc: 'Add, edit, and manage client accounts',
          detail: `${activeClients} active`,
          icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
        },
      ],
    },
    {
      title: 'AUTOMATION',
      cards: [
        {
          href: '/settings/sync',
          title: 'Data Sync',
          desc: `${activeAccounts} accounts — Last sync: ${lastSyncTime}`,
          detail: org?.sync_enabled ? `Daily at ${org?.sync_time || '01:30'}` : 'Disabled',
          status: org?.sync_enabled ? (syncHealthy ? 'healthy' : 'warning') : 'off',
          icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
        },
        {
          href: '/settings/reports',
          title: 'Report Schedule',
          desc: 'Auto-generation day, time, and per-client overrides',
          detail: org?.report_auto_generate ? `${dayNames[org?.report_day ?? 1]}s auto-generate` : 'Manual only',
          status: org?.report_auto_generate ? 'healthy' : 'off',
          icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
        },
        {
          href: '/settings/agency#ai',
          title: 'AI Configuration',
          desc: 'Gemini API key for Pegasus AI, reports, and creative tools',
          detail: org?.gemini_api_key ? 'Key configured' : 'Not configured',
          status: org?.gemini_api_key ? 'healthy' : 'warning',
          icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5"/></svg>,
        },
      ],
    },
    {
      title: 'MONITORING',
      cards: [
        {
          href: '/settings/usage',
          title: 'API Usage',
          desc: 'Gemini API usage and estimated costs',
          icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17V13m5 4V7m5 10v-4"/></svg>,
        },
        {
          href: '/settings/activity',
          title: 'Activity Log',
          desc: 'Track all changes and actions',
          icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
        },
      ],
    },
  ]

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[1000px] mx-auto">
          <div className="mb-6">
            <h2 className="text-[20px] font-semibold text-[#111113]">Settings</h2>
            <p className="text-[13px] text-[#9d9da8]">{org?.name || 'Organization'}</p>
          </div>

          {sections.map(section => (
            <div key={section.title} className="mb-6">
              <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider mb-3">{section.title}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {section.cards.map(c => (
                  <Link key={c.href} href={c.href}>
                    <Card className="p-4 card-hover cursor-pointer h-full">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded bg-[#f4f4f6] flex items-center justify-center shrink-0 text-[#9d9da8]">
                          {c.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[13px] font-semibold text-[#111113]">{c.title}</h3>
                            {'status' in c && c.status && (
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                c.status === 'healthy' ? 'bg-[#16a34a]' : c.status === 'warning' ? 'bg-[#f59e0b]' : 'bg-[#d4d4d8]'
                              }`} />
                            )}
                          </div>
                          <p className="text-[11px] text-[#9d9da8] mt-0.5 line-clamp-1">{c.desc}</p>
                          {'detail' in c && c.detail && (
                            <p className="text-[10px] text-[#6b6b76] mt-1.5 font-medium">{c.detail}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PageWrapper>
    </>
  )
}
