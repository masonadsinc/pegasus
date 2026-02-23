import { Nav } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 60

const ORG_ID = process.env.ADSINC_ORG_ID!

async function getOrgData() {
  const [orgRes, membersRes, clientsRes, accountsRes, syncRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('*').eq('id', ORG_ID).single(),
    supabaseAdmin.from('org_members').select('id, role, display_name, user_id').eq('org_id', ORG_ID),
    supabaseAdmin.from('clients').select('id, status').eq('org_id', ORG_ID),
    supabaseAdmin.from('ad_accounts').select('id, is_active').eq('org_id', ORG_ID),
    supabaseAdmin.from('sync_logs').select('id, completed_at, status, records_synced, errors, duration_ms').eq('org_id', ORG_ID).order('completed_at', { ascending: false }).limit(1),
  ])
  return {
    org: orgRes.data,
    members: membersRes.data || [],
    clients: clientsRes.data || [],
    accounts: accountsRes.data || [],
    lastSync: syncRes.data?.[0],
  }
}

function SettingsCard({ href, title, description, stat }: { href: string; title: string; description: string; stat?: string }) {
  return (
    <Link href={href}>
      <Card className="p-5 hover:bg-zinc-800/50 transition-colors cursor-pointer h-full">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-zinc-500 mt-1">{description}</p>
          </div>
          {stat && <span className="text-lg font-bold text-zinc-400">{stat}</span>}
        </div>
      </Card>
    </Link>
  )
}

export default async function SettingsPage() {
  const { org, members, clients, accounts, lastSync } = await getOrgData()

  const activeClients = clients.filter(c => c.status === 'active').length
  const activeAccounts = accounts.filter(a => a.is_active).length
  const lastSyncTime = lastSync?.completed_at
    ? new Date(lastSync.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Never'

  return (
    <main className="min-h-screen pb-8">
      <Nav current="settings" />

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-sm text-zinc-500">{org?.name || 'Organization'} · {org?.plan || 'Starter'} plan</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsCard
            href="/settings/clients"
            title="Clients"
            description="Add, edit, and manage client accounts"
            stat={`${activeClients}`}
          />
          <SettingsCard
            href="/settings/team"
            title="Team"
            description="Manage team members and roles"
            stat={`${members.length}`}
          />
          <SettingsCard
            href="/settings/sync"
            title="Sync Status"
            description={`Last sync: ${lastSyncTime}`}
            stat={`${activeAccounts}`}
          />
          <Card className="p-5 opacity-50">
            <h3 className="font-semibold text-sm">Integrations</h3>
            <p className="text-xs text-zinc-500 mt-1">Stripe, Mercury, Slack — coming soon</p>
          </Card>
        </div>
      </div>
    </main>
  )
}
