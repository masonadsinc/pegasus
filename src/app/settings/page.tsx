import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 60
const ORG_ID = process.env.ADSINC_ORG_ID!

async function getOrgData() {
  const [orgRes, membersRes, clientsRes, accountsRes, syncRes, activityRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('*').eq('id', ORG_ID).single(),
    supabaseAdmin.from('org_members').select('id').eq('org_id', ORG_ID),
    supabaseAdmin.from('clients').select('id, status').eq('org_id', ORG_ID),
    supabaseAdmin.from('ad_accounts').select('id, is_active').eq('org_id', ORG_ID),
    supabaseAdmin.from('sync_logs').select('id, completed_at').eq('org_id', ORG_ID).order('completed_at', { ascending: false }).limit(1),
    supabaseAdmin.from('activity_log').select('id').eq('org_id', ORG_ID).order('created_at', { ascending: false }).limit(1),
  ])
  return {
    org: orgRes.data,
    members: membersRes.data || [],
    clients: clientsRes.data || [],
    accounts: accountsRes.data || [],
    lastSync: syncRes.data?.[0],
    hasActivity: (activityRes.data || []).length > 0,
  }
}

export default async function SettingsPage() {
  const { org, members, clients, accounts, lastSync, hasActivity } = await getOrgData()
  const activeClients = clients.filter(c => c.status === 'active').length
  const activeAccounts = accounts.filter(a => a.is_active).length
  const lastSyncTime = lastSync?.completed_at
    ? new Date(lastSync.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Never'

  const cards = [
    { href: '/settings/clients', title: 'Clients', desc: 'Add, edit, and manage client accounts', stat: `${activeClients}`, icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9d9da8" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    )},
    { href: '/settings/team', title: 'Team', desc: 'Manage team members and roles', stat: `${members.length}`, icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9d9da8" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    )},
    { href: '/settings/sync', title: 'Sync Status', desc: `Last sync: ${lastSyncTime}`, stat: `${activeAccounts}`, icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9d9da8" strokeWidth="1.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
    )},
    { href: '/settings/agency', title: 'Agency', desc: 'Branding, logo, and preferences', stat: '', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9d9da8" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    )},
    { href: '/settings/activity', title: 'Activity Log', desc: 'Track all changes and actions', stat: '', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9d9da8" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    )},
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map(c => (
              <Link key={c.href} href={c.href}>
                <Card className="p-5 card-hover cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded bg-[#f4f4f6] flex items-center justify-center">
                      {c.icon}
                    </div>
                    {c.stat && <span className="text-[18px] font-semibold text-[#9d9da8] tabular-nums">{c.stat}</span>}
                  </div>
                  <h3 className="text-[13px] font-semibold text-[#111113]">{c.title}</h3>
                  <p className="text-[12px] text-[#9d9da8] mt-0.5">{c.desc}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
