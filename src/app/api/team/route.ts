import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { getOrgId } from '@/lib/org'


export async function POST(req: NextRequest) {
  const ORG_ID = await getOrgId()
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { email, password, role, display_name } = body

    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    if (!['admin', 'operator', 'viewer'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

    const { error: memberError } = await supabaseAdmin
      .from('org_members')
      .insert({
        org_id: ORG_ID,
        user_id: authData.user.id,
        role,
        display_name: display_name || null,
      })

    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

    await supabaseAdmin.from('activity_log').insert({
      org_id: ORG_ID,
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.email,
      action: 'invited',
      target_type: 'team_member',
      target_name: display_name || email,
      details: `Role: ${role}`,
    })

    return NextResponse.json({ success: true, user_id: authData.user.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
