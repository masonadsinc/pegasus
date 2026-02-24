import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const allowed = ['name', 'logo_url', 'primary_color', 'gemini_api_key']
    const update: any = {}
    for (const key of allowed) {
      if (key in body) update[key] = body[key] === '' ? null : body[key]
    }

    if (update.name) {
      update.slug = update.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    }

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update(update)
      .eq('id', ORG_ID)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin.from('activity_log').insert({
      org_id: ORG_ID,
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.email,
      action: 'updated agency settings',
      target_type: 'organization',
      details: `Updated: ${Object.keys(update).join(', ')}`,
    })

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
