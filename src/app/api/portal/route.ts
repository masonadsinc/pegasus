import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import crypto from 'crypto'

const ORG_ID = process.env.ADSINC_ORG_ID!

// POST /api/portal — generate or regenerate portal token for a client
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const token = crypto.randomBytes(24).toString('hex')

  const { error } = await supabaseAdmin
    .from('clients')
    .update({ portal_token: token })
    .eq('id', clientId)
    .eq('org_id', ORG_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('activity_log').insert({
    org_id: ORG_ID,
    actor_type: 'user',
    actor_id: user.id,
    actor_name: user.email,
    action: 'generated portal link',
    target_type: 'client',
    target_id: clientId,
  })

  return NextResponse.json({ token })
}

// DELETE /api/portal — revoke portal token
export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('clients')
    .update({ portal_token: null })
    .eq('id', clientId)
    .eq('org_id', ORG_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
