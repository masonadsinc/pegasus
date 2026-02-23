import { Nav } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { TeamActions } from './team-actions'

export const revalidate = 30

const ORG_ID = process.env.ADSINC_ORG_ID!

async function getTeam() {
  const { data, error } = await supabaseAdmin
    .from('org_members')
    .select('id, role, display_name, user_id, created_at')
    .eq('org_id', ORG_ID)
    .order('created_at')

  if (error) throw error

  // Get user emails
  const userIds = (data || []).map(m => m.user_id)
  const members = []
  for (const m of data || []) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(m.user_id)
    members.push({
      ...m,
      email: userData?.user?.email || 'Unknown',
    })
  }
  return members
}

const roleColors: Record<string, 'excellent' | 'good' | 'warning' | 'neutral'> = {
  owner: 'excellent',
  admin: 'good',
  operator: 'warning',
  viewer: 'neutral',
  ai_agent: 'neutral',
}

export default async function TeamPage() {
  const members = await getTeam()

  return (
    <main className="min-h-screen pb-8">
      <Nav current="settings" />

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs text-zinc-500 mb-1">
              <Link href="/settings" className="hover:text-zinc-300">Settings</Link>
              <span className="mx-1">/</span>
              <span className="text-zinc-300">Team</span>
            </div>
            <h1 className="text-xl font-bold">Team Management</h1>
            <p className="text-sm text-zinc-500">{members.length} members</p>
          </div>
          <TeamActions />
        </div>

        <div className="space-y-2">
          {members.map(member => (
            <Card key={member.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{member.display_name || member.email}</h3>
                    <Badge variant={roleColors[member.role] || 'neutral'}>{member.role}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{member.email}</p>
                </div>
                <p className="text-xs text-zinc-500">Joined {new Date(member.created_at).toLocaleDateString()}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
          <h3 className="text-sm font-semibold text-zinc-400 mb-2">Role Permissions</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
            <div><span className="text-zinc-300">Owner</span> — Full access, billing, delete org</div>
            <div><span className="text-zinc-300">Admin</span> — Manage clients, team, settings</div>
            <div><span className="text-zinc-300">Operator</span> — View + edit ads, run reports</div>
            <div><span className="text-zinc-300">Viewer</span> — Read-only dashboard access</div>
          </div>
        </div>
      </div>
    </main>
  )
}
