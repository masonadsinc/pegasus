import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('report_day, report_time, report_auto_generate, report_default_days, timezone')
    .eq('id', ORG_ID)
    .single()

  const { data: overrides } = await supabaseAdmin
    .from('report_schedules')
    .select('*, clients(name)')
    .eq('org_id', ORG_ID)
    .order('created_at')

  return NextResponse.json({
    settings: {
      report_day: org?.report_day ?? 1,
      report_time: org?.report_time ?? '08:00',
      report_auto_generate: org?.report_auto_generate ?? false,
      report_default_days: org?.report_default_days ?? 7,
      report_timezone: org?.timezone ?? 'America/Los_Angeles',
    },
    overrides: overrides || [],
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['report_day', 'report_time', 'report_auto_generate', 'report_default_days']
  const updates: Record<string, any> = {}

  for (const key of allowed) {
    if (body[key] !== undefined) {
      if (key === 'report_day') {
        const d = parseInt(body[key])
        if (d < 0 || d > 6) continue
        updates[key] = d
      } else if (key === 'report_default_days') {
        const d = parseInt(body[key])
        if (![7, 14, 30, 60, 90].includes(d)) continue
        updates[key] = d
      } else if (key === 'report_auto_generate') {
        updates[key] = Boolean(body[key])
      } else {
        updates[key] = String(body[key])
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('organizations')
    .update(updates)
    .eq('id', ORG_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('activity_log').insert({
    org_id: ORG_ID,
    actor_type: 'user',
    actor_id: user.id,
    actor_name: user.email,
    action: 'updated report settings',
    target_type: 'settings',
    details: JSON.stringify(updates),
  })

  return NextResponse.json({ ok: true })
}
