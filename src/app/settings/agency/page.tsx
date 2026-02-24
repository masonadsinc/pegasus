import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { AgencyForm, GeminiKeyForm } from './agency-form'

export const revalidate = 30
const ORG_ID = process.env.ADSINC_ORG_ID!

function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

async function getOrg() {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, logo_url, primary_color, plan, gemini_api_key')
    .eq('id', ORG_ID)
    .single()
  
  if (!data) return null

  const hasKey = !!data.gemini_api_key

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    logo_url: data.logo_url,
    primary_color: data.primary_color,
    plan: data.plan,
    has_gemini_key: hasKey,
    gemini_key_masked: hasKey ? maskKey(data.gemini_api_key) : '',
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
            <span className="text-[#6b6b76]">Agency</span>
          </div>
          <h2 className="text-[20px] font-semibold text-[#111113] mb-1">Agency Settings</h2>
          <p className="text-[13px] text-[#9d9da8] mb-6">Manage your agency branding and preferences</p>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-[13px] font-semibold text-[#111113] mb-4">Branding</h3>
              <AgencyForm org={org} />
            </Card>

            <Card className="p-6">
              <h3 className="text-[13px] font-semibold text-[#111113] mb-4">Pegasus AI</h3>
              <GeminiKeyForm hasKey={org?.has_gemini_key || false} maskedKey={org?.gemini_key_masked || ''} />
            </Card>

            <Card className="p-6">
              <h3 className="text-[13px] font-semibold text-[#111113] mb-3">Plan</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium text-[#111113] capitalize">{org?.plan || 'Starter'}</p>
                  <p className="text-[12px] text-[#9d9da8] mt-0.5">Contact us to upgrade your plan</p>
                </div>
                <span className="px-3 py-1.5 rounded bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a] text-[11px] font-semibold uppercase tracking-wider">Active</span>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-[13px] font-semibold text-[#111113] mb-3">Danger Zone</h3>
              <p className="text-[12px] text-[#9d9da8] mb-3">These actions are destructive and cannot be reversed.</p>
              <button disabled className="px-4 py-2 rounded border border-[#fecaca] text-[#dc2626] text-[12px] font-medium opacity-50 cursor-not-allowed">
                Delete Organization
              </button>
            </Card>
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
