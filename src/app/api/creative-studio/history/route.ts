import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrgId } from '@/lib/org'


export async function GET(req: NextRequest) {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('clientId')

  let query = supabaseAdmin
    .from('generated_creatives')
    .select('id, prompt, concept, aspect_ratio, resolution, image_data, model, metadata, source, client_id, created_at')
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(50)

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ creatives: data || [] })
}

export async function DELETE(req: NextRequest) {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('generated_creatives')
    .delete()
    .eq('id', id)
    .eq('org_id', ORG_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
