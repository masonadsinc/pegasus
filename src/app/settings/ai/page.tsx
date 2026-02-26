import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { GeminiKeyForm } from '../agency/agency-form'
import { getOrgId } from '@/lib/org'

export const revalidate = 30
const ORG_ID = await getOrgId()

function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

async function getAIConfig() {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('gemini_api_key')
    .eq('id', ORG_ID)
    .single()

  const hasKey = !!data?.gemini_api_key
  return {
    has_gemini_key: hasKey,
    gemini_key_masked: hasKey ? maskKey(data!.gemini_api_key) : '',
  }
}

export default async function AISettingsPage() {
  const config = await getAIConfig()

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[800px] mx-auto">
          <div className="text-[12px] text-[#9d9da8] mb-1">
            <Link href="/settings" className="hover:text-[#111113]">Settings</Link>
            <span className="mx-1.5">/</span>
            <span className="text-[#6b6b76]">AI Configuration</span>
          </div>
          <h2 className="text-[20px] font-semibold text-[#111113] mb-1">AI Configuration</h2>
          <p className="text-[13px] text-[#9d9da8] mb-6">Manage API keys and AI provider settings</p>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-[13px] font-semibold text-[#111113] mb-1">Gemini API Key</h3>
              <p className="text-[11px] text-[#9d9da8] mb-4">Powers Pegasus AI chat, report generation, creative analysis, image studio, and the copywriter. Required for all AI features.</p>
              <GeminiKeyForm hasKey={config.has_gemini_key} maskedKey={config.gemini_key_masked} />
            </Card>

            <Card className="p-6">
              <h3 className="text-[13px] font-semibold text-[#111113] mb-1">AI Features</h3>
              <p className="text-[11px] text-[#9d9da8] mb-4">Features powered by your Gemini API key.</p>
              <div className="space-y-3">
                {[
                  { name: 'Pegasus AI Chat', desc: 'Client-scoped AI media buyer assistant', model: 'Gemini Flash' },
                  { name: 'Report Generation', desc: 'Weekly performance reports with AI narrative', model: 'Gemini Flash' },
                  { name: 'Creative Analysis', desc: 'Vision-based analysis of top ad creatives', model: 'Gemini Flash' },
                  { name: 'Image Studio', desc: 'AI-generated ad creative variations', model: 'Gemini Pro Image' },
                  { name: 'Copywriter', desc: 'Framework-based ad copy generation', model: 'Gemini Flash' },
                ].map(f => (
                  <div key={f.name} className="flex items-center justify-between py-2 border-b border-[#f4f4f6] last:border-0">
                    <div>
                      <p className="text-[13px] font-medium text-[#111113]">{f.name}</p>
                      <p className="text-[11px] text-[#9d9da8]">{f.desc}</p>
                    </div>
                    <span className="text-[10px] font-medium text-[#6b6b76] bg-[#f4f4f6] px-2 py-1 rounded">{f.model}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
