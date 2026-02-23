import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { TeamActions, MemberActions } from './team-actions'

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
  owner: 'success', admin: 'info', operator: 'warning', viewer: 'neutral', ai_agent: 'neutral',
}

export default async function TeamPage() {
  const members = await getTeam()

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[1000px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[12px] text-[#9d9da8] mb-1">
                <Link href="/settings" className="hover:text-[#111113]">Settings</Link>
                <span className="mx-1.5">/</span>
                <span className="text-[#6b6b76]">Team</span>
              </div>
              <h2 className="text-[20px] font-semibold text-[#111113]">Team Management</h2>
              <p className="text-[13px] text-[#9d9da8]">{members.length} members</p>
            </div>
            <TeamActions />
          </div>

          <div className="space-y-2">
            {members.map(member => (
              <Card key={member.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#f4f4f6] flex items-center justify-center text-[12px] font-semibold text-[#6b6b76]">
                      {(member.display_name || member.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13px] font-medium text-[#111113]">{member.display_name || member.email}</h3>
                        <Badge variant={roleColors[member.role] || 'neutral'}>{member.role}</Badge>
                      </div>
                      <p className="text-[12px] text-[#9d9da8] mt-0.5">{member.email} · Joined {new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <MemberActions member={{ id: member.id, role: member.role, display_name: member.display_name, email: member.email }} />
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-5 mt-6">
            <h3 className="text-[13px] font-semibold text-[#111113] mb-3">Role Permissions</h3>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="flex gap-2"><span className="w-16 text-[#6b6b76] font-medium flex-shrink-0">Owner</span><span className="text-[#9d9da8]">Full access, billing, org settings</span></div>
              <div className="flex gap-2"><span className="w-16 text-[#6b6b76] font-medium flex-shrink-0">Admin</span><span className="text-[#9d9da8]">Manage clients, team, settings</span></div>
              <div className="flex gap-2"><span className="w-16 text-[#6b6b76] font-medium flex-shrink-0">Operator</span><span className="text-[#9d9da8]">View + edit ads, run reports</span></div>
              <div className="flex gap-2"><span className="w-16 text-[#6b6b76] font-medium flex-shrink-0">Viewer</span><span className="text-[#9d9da8]">Read-only dashboard access</span></div>
            </div>
          </Card>
        </div>
      </PageWrapper>
    </>
  )
}
