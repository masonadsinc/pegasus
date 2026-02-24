import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'

const ORG_ID = process.env.ADSINC_ORG_ID!

// GET /api/creatives/history?clientId=xxx
export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('creative_analyses')
    .select('id, period_days, ads_analyzed, analysis_text, created_at')
    .eq('org_id', ORG_ID)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ analyses: data || [] })
}
