import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
