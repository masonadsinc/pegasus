import { Nav, PageWrapper } from '@/components/nav'
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
  const members = []
  for (const m of data || []) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(m.user_id)
    members.push({ ...m, email: userData?.user?.email || 'Unknown' })
  }
  return members
}

const roleColors: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  owner: 'success',
  admin: 'info',
  operator: 'warning',
  viewer: 'neutral',
  ai_agent: 'neutral',
}

export default async function TeamPage() {
  const members = await getTeam()

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-8 max-w-[1000px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="text-[12px] text-zinc-500 mb-3 flex items-center gap-1.5">
                <Link href="/settings" className="hover:text-white transition-colors">Settings</Link>
                <span className="text-zinc-700">/</span>
                <span className="text-zinc-300">Team</span>
              </div>
              <h1 className="text-2xl font-semibold text-white">Team Management</h1>
              <p className="text-sm text-zinc-500 mt-1">{members.length} members</p>
            </div>
            <TeamActions />
          </div>

          <div className="space-y-2">
            {members.map(member => (
              <Card key={member.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-medium text-white">{member.display_name || member.email}</h3>
                      <Badge variant={roleColors[member.role] || 'neutral'}>{member.role}</Badge>
                    </div>
                    <p className="text-[12px] text-zinc-500 mt-0.5">{member.email}</p>
                  </div>
                  <p className="text-[12px] text-zinc-500">Joined {new Date(member.created_at).toLocaleDateString()}</p>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-5 mt-8">
            <h3 className="text-sm font-medium text-white mb-3">Role Permissions</h3>
            <div className="grid grid-cols-2 gap-2 text-[12px] text-zinc-500">
              <div><span className="text-zinc-300">Owner</span> — Full access, billing, delete org</div>
              <div><span className="text-zinc-300">Admin</span> — Manage clients, team, settings</div>
              <div><span className="text-zinc-300">Operator</span> — View + edit ads, run reports</div>
              <div><span className="text-zinc-300">Viewer</span> — Read-only dashboard access</div>
            </div>
          </Card>
        </div>
      </PageWrapper>
    </>
  )
}
