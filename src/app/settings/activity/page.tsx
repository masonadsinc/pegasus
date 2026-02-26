import { Nav, PageWrapper } from '@/components/nav'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { ActivityLog } from './activity-log'

export const revalidate = 30
const ORG_ID = process.env.ADSINC_ORG_ID!

async function getActivity() {
  const { data } = await supabaseAdmin
    .from('activity_log')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(500)
  return data || []
}

export default async function ActivityPage() {
  const activity = await getActivity()

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[800px] mx-auto">
          <div className="text-[12px] text-[#9d9da8] mb-1">
            <Link href="/settings" className="hover:text-[#111113]">Settings</Link>
            <span className="mx-1.5">/</span>
            <span className="text-[#6b6b76]">Activity</span>
          </div>
          <h2 className="text-[20px] font-semibold text-[#111113] mb-1">Activity Log</h2>
          <p className="text-[13px] text-[#9d9da8] mb-6">Track all changes across your organization</p>

          <ActivityLog activities={activity} />
        </div>
      </PageWrapper>
    </>
  )
}
