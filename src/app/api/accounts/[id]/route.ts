import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { getOrgId } from '@/lib/org'


export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ORG_ID = await getOrgId()
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const allowed = ['objective', 'primary_action_type', 'target_cpl', 'target_roas', 'is_active', 'name']
    const update: any = {}
    for (const key of allowed) {
      if (key in body) {
        if (key === 'target_cpl' || key === 'target_roas') {
          update[key] = body[key] === '' || body[key] === null ? null : parseFloat(body[key])
        } else if (key === 'is_active') {
          update[key] = body[key] === 'on' || body[key] === true
        } else {
          update[key] = body[key] === '' ? null : body[key]
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('ad_accounts')
      .update(update)
      .eq('id', id)
      .eq('org_id', ORG_ID)
      .select('*, clients!inner(id, name)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin.from('activity_log').insert({
      org_id: ORG_ID,
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.email,
      action: 'updated account settings',
      target_type: 'ad_account',
      target_id: id,
      target_name: data.name,
      details: `Updated: ${Object.keys(update).join(', ')}`,
      client_id: (data.clients as any)?.id || null,
    })

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
