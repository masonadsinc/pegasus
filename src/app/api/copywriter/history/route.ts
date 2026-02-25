import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('copy_banks')
    .select('id, period_days, messaging_foundation, status, created_at, raw_output')
    .eq('org_id', ORG_ID)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ banks: data || [] })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status, raw_output } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: any = { updated_at: new Date().toISOString() }
  if (status) updates.status = status
  if (raw_output !== undefined) updates.raw_output = raw_output

  const { error } = await supabaseAdmin
    .from('copy_banks')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ORG_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
