import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { getOrgId } from '@/lib/org'

export async function GET(req: NextRequest) {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('clientId')
  const convId = req.nextUrl.searchParams.get('id')

  // Single conversation with messages
  if (convId) {
    const { data, error } = await supabaseAdmin
      .from('pegasus_conversations')
      .select('*')
      .eq('id', convId)
      .eq('org_id', ORG_ID)
      .eq('user_id', user.id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // List conversations (without messages for performance)
  let query = supabaseAdmin
    .from('pegasus_conversations')
    .select('id, client_id, title, days, created_at, updated_at, clients!inner(name)')
    .eq('org_id', ORG_ID)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId, title, messages, days } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('pegasus_conversations')
    .insert({
      org_id: ORG_ID,
      client_id: clientId,
      user_id: user.id,
      title: title || 'New conversation',
      messages: messages || [],
      days: days || 7,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, title, messages } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: any = { updated_at: new Date().toISOString() }
  if (title !== undefined) updates.title = title
  if (messages !== undefined) updates.messages = messages

  const { error } = await supabaseAdmin
    .from('pegasus_conversations')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ORG_ID)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('pegasus_conversations')
    .delete()
    .eq('id', id)
    .eq('org_id', ORG_ID)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
