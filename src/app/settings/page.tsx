import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 60
const ORG_ID = process.env.ADSINC_ORG_ID!

async function getOrgData() {
  const [orgRes, membersRes, clientsRes, accountsRes, syncRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('*').eq('id', ORG_ID).single(),
    supabaseAdmin.from('org_members').select('id').eq('org_id', ORG_ID),
    supabaseAdmin.from('clients').select('id, status').eq('org_id', ORG_ID),
    supabaseAdmin.from('ad_accounts').select('id, is_active').eq('org_id', ORG_ID),
    supabaseAdmin.from('sync_logs').select('id, completed_at').eq('org_id', ORG_ID).order('completed_at', { ascending: false }).limit(1),
  ])
  return {
    org: orgRes.data,
    members: membersRes.data || [],
    clients: clientsRes.data || [],
    accounts: accountsRes.data || [],
    lastSync: syncRes.data?.[0],
  }
}

export default async function SettingsPage() {
  const { org, members, clients, accounts, lastSync } = await getOrgData()
  const activeClients = clients.filter(c => c.status === 'active').length
  const activeAccounts = accounts.filter(a => a.is_active).length
  const lastSyncTime = lastSync?.completed_at
    ? new Date(lastSync.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Never'

  const cards = [
    { href: '/settings/clients', title: 'Clients', desc: 'Add, edit, and manage client accounts', stat: `${activeClients}` },
    { href: '/settings/team', title: 'Team', desc: 'Manage team members and roles', stat: `${members.length}` },
    { href: '/settings/sync', title: 'Sync Status', desc: `Last sync: ${lastSyncTime}`, stat: `${activeAccounts}` },
  ]

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[1000px] mx-auto">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#111113]">Settings</h2>
            <p className="text-[13px] text-[#9d9da8]">{org?.name || 'Organization'} · {org?.plan || 'Starter'} plan</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map(c => (
              <Link key={c.href} href={c.href}>
                <Card className="p-5 hover:bg-[#fafafb] transition-colors cursor-pointer h-full">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#111113]">{c.title}</h3>
                      <p className="text-[12px] text-[#9d9da8] mt-1">{c.desc}</p>
                    </div>
                    <span className="text-lg font-semibold text-[#9d9da8]">{c.stat}</span>
                  </div>
                </Card>
              </Link>
            ))}
            <Card className="p-5 opacity-40">
              <h3 className="text-[14px] font-semibold text-[#9d9da8]">Integrations</h3>
              <p className="text-[12px] text-[#c4c4cc] mt-1">Stripe, Mercury, Slack — coming soon</p>
            </Card>
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
