import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { AgencyForm } from './agency-form'
import { getOrgId } from '@/lib/org'

export const revalidate = 30
const ORG_ID = await getOrgId()

async function getOrg() {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, logo_url, primary_color, plan, timezone')
    .eq('id', ORG_ID)
    .single()
  
  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    logo_url: data.logo_url,
    primary_color: data.primary_color,
    timezone: data.timezone,
    plan: data.plan,
  }
}

export default async function AgencySettingsPage() {
  const org = await getOrg()

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[800px] mx-auto">
          <div className="text-[12px] text-[#9d9da8] mb-1">
            <Link href="/settings" className="hover:text-[#111113]">Settings</Link>
            <span className="mx-1.5">/</span>
            <span className="text-[#6b6b76]">General</span>
          </div>
          <h2 className="text-[20px] font-semibold text-[#111113] mb-1">General Settings</h2>
          <p className="text-[13px] text-[#9d9da8] mb-6">Agency identity, timezone, and preferences</p>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-[13px] font-semibold text-[#111113] mb-1">Agency Profile</h3>
              <p className="text-[11px] text-[#9d9da8] mb-4">Your agency name, logo, brand color, and timezone. The timezone setting controls all date calculations across the platform.</p>
              <AgencyForm org={org} />
            </Card>

            <Card className="p-6">
              <h3 className="text-[13px] font-semibold text-[#111113] mb-1">Plan</h3>
              <p className="text-[11px] text-[#9d9da8] mb-3">Your current subscription level.</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium text-[#111113] capitalize">{org?.plan || 'Starter'}</p>
                  <p className="text-[12px] text-[#9d9da8] mt-0.5">Contact us to upgrade your plan</p>
                </div>
                <span className="px-3 py-1.5 rounded bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a] text-[11px] font-semibold uppercase tracking-wider">Active</span>
              </div>
            </Card>
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
