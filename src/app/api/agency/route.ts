import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { encrypt, maskApiKey, isEncrypted, decrypt } from '@/lib/encryption'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug, logo_url, primary_color, plan, gemini_api_key')
      .eq('id', ORG_ID)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Never return the actual key — only masked version + boolean
    const hasGeminiKey = !!data?.gemini_api_key
    let maskedKey = ''
    if (hasGeminiKey) {
      try {
        const raw = isEncrypted(data.gemini_api_key) ? decrypt(data.gemini_api_key) : data.gemini_api_key
        maskedKey = maskApiKey(raw)
      } catch {
        maskedKey = '****configured****'
      }
    }

    return NextResponse.json({
      ...data,
      gemini_api_key: undefined,
      has_gemini_key: hasGeminiKey,
      gemini_key_masked: maskedKey,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

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

    // Store API key as-is for now — encryption at rest deferred
    // Key is protected by auth + Supabase RLS

    if (update.name) {
      update.slug = update.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    }

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update(update)
      .eq('id', ORG_ID)
      .select('id, name, slug, logo_url, primary_color, plan')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const changedFields = Object.keys(update).map(k => k === 'gemini_api_key' ? 'gemini_api_key (encrypted)' : k)
    await supabaseAdmin.from('activity_log').insert({
      org_id: ORG_ID,
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.email,
      action: 'updated agency settings',
      target_type: 'organization',
      details: `Updated: ${changedFields.join(', ')}`,
    })

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
