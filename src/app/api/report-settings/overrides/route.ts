import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { client_id, report_day, report_time, period_days, enabled } = body

  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('report_schedules')
    .upsert({
      org_id: ORG_ID,
      client_id,
      report_day: report_day !== undefined ? parseInt(report_day) : null,
      report_time: report_time || null,
      period_days: period_days ? parseInt(period_days) : null,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,client_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  await supabaseAdmin
    .from('report_schedules')
    .delete()
    .eq('org_id', ORG_ID)
    .eq('client_id', clientId)

  return NextResponse.json({ ok: true })
}
