import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'

const ORG_ID = process.env.ADSINC_ORG_ID!

// PATCH /api/reports/[id] — update content, status, notes
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const allowed = ['content', 'subject', 'status', 'notes']
  const update: any = { updated_at: new Date().toISOString() }

  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Set timestamps based on status changes
  if (body.status === 'reviewed') {
    update.reviewed_at = new Date().toISOString()
    update.reviewed_by = user.id
  }
  if (body.status === 'sent') {
    update.sent_at = new Date().toISOString()
    update.sent_by = user.id
  }

  const { data, error } = await supabaseAdmin
    .from('weekly_reports')
    .update(update)
    .eq('id', id)
    .eq('org_id', ORG_ID)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('activity_log').insert({
    org_id: ORG_ID,
    actor_type: 'user',
    actor_id: user.id,
    actor_name: user.email,
    action: body.status ? `marked report ${body.status}` : 'edited report',
    target_type: 'report',
    target_id: id,
    target_name: data.client_name,
    client_id: data.client_id,
    details: body.status ? `Week ${data.week}` : `Updated: ${Object.keys(update).filter(k => k !== 'updated_at').join(', ')}`,
  })

  return NextResponse.json(data)
}
