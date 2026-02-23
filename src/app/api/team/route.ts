import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, role, display_name } = body

    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    if (!['admin', 'operator', 'viewer'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

    // Add to org
    const { error: memberError } = await supabaseAdmin
      .from('org_members')
      .insert({
        org_id: ORG_ID,
        user_id: authData.user.id,
        role,
        display_name: display_name || null,
      })

    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

    return NextResponse.json({ success: true, user_id: authData.user.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
