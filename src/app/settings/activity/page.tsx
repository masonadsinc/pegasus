import { Nav, PageWrapper } from '@/components/nav'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { ActivityLog } from './activity-log'
import { getOrgId } from '@/lib/org'

export const revalidate = 30
const ORG_ID = await getOrgId()

async function getActivity() {
  const [activityRes, membersRes] = await Promise.all([
    supabaseAdmin
      .from('activity_log')
      .select('*')
      .eq('org_id', ORG_ID)
      .order('created_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('org_members')
      .select('user_id, email, role')
      .eq('org_id', ORG_ID),
  ])

  // Build a user lookup map
  const userMap: Record<string, { email: string; role: string }> = {}
  for (const m of membersRes.data || []) {
    userMap[m.user_id] = { email: m.email, role: m.role }
  }

  return {
    activities: activityRes.data || [],
    userMap,
  }
}

export default async function ActivityPage() {
  const { activities, userMap } = await getActivity()

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[1200px] mx-auto">
          <div className="text-[12px] text-[#9d9da8] mb-1">
            <Link href="/settings" className="hover:text-[#111113]">Settings</Link>
            <span className="mx-1.5">/</span>
            <span className="text-[#6b6b76]">Activity</span>
          </div>
          <h2 className="text-[20px] font-semibold text-[#111113] mb-1">Activity Log</h2>
          <p className="text-[13px] text-[#9d9da8] mb-6">Full audit trail — every action by users, AI, and system</p>

          <ActivityLog activities={activities} userMap={userMap} />
        </div>
      </PageWrapper>
    </>
  )
}
