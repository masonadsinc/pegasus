import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrgId } from '@/lib/org'


export async function GET(req: NextRequest) {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('generated_creatives')
    .select('image_data')
    .eq('id', id)
    .eq('org_id', ORG_ID)
    .single()

  if (!data?.image_data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Return as actual image
  const buffer = Buffer.from(data.image_data, 'base64')
  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
