import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { getOrgId } from '@/lib/org'


export async function GET() {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [orgRes, clientsRes, accountsRes, syncRes, reportsRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('timezone, gemini_api_key, onboarding_dismissed').eq('id', ORG_ID).single(),
    supabaseAdmin.from('clients').select('id', { count: 'exact', head: true }).eq('org_id', ORG_ID).eq('status', 'active'),
    supabaseAdmin.from('ad_accounts').select('id', { count: 'exact', head: true }).eq('org_id', ORG_ID).eq('is_active', true),
    supabaseAdmin.from('sync_logs').select('id', { count: 'exact', head: true }).eq('org_id', ORG_ID),
    supabaseAdmin.from('weekly_reports').select('id', { count: 'exact', head: true }).eq('org_id', ORG_ID),
  ])

  return NextResponse.json({
    hasTimezone: !!orgRes.data?.timezone,
    hasGeminiKey: !!orgRes.data?.gemini_api_key,
    hasClients: (clientsRes.count || 0) > 0,
    hasAccounts: (accountsRes.count || 0) > 0,
    hasSyncRun: (syncRes.count || 0) > 0,
    hasReport: (reportsRes.count || 0) > 0,
    dismissed: orgRes.data?.onboarding_dismissed ?? false,
  })
}

export async function PATCH(req: NextRequest) {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { dismissed } = await req.json()
  await supabaseAdmin.from('organizations').update({ onboarding_dismissed: !!dismissed }).eq('id', ORG_ID)
  return NextResponse.json({ ok: true })
}
