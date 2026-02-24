import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('brand_assets')
    .select('*')
    .eq('org_id', ORG_ID)
    .eq('client_id', clientId)
    .single()

  return NextResponse.json({ assets: data || null })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { clientId, styleGuide, brandColors, visualTone, typographyNotes, hardRules, referenceImages, creativePrefs } = body
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('brand_assets')
    .upsert({
      org_id: ORG_ID,
      client_id: clientId,
      style_guide: styleGuide || null,
      brand_colors: brandColors || [],
      visual_tone: visualTone || null,
      typography_notes: typographyNotes || null,
      hard_rules: hardRules || null,
      reference_images: referenceImages || [],
      creative_prefs: creativePrefs || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,client_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('activity_log').insert({
    org_id: ORG_ID,
    actor_type: 'user',
    actor_id: user.id,
    actor_name: user.email,
    action: 'updated brand assets',
    target_type: 'client',
    target_id: clientId,
  })

  return NextResponse.json({ assets: data })
}
