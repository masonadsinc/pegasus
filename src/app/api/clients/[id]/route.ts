import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const allowed = ['name', 'industry', 'website', 'monthly_retainer', 'rev_share_pct', 'primary_contact_name', 'primary_contact_email', 'primary_contact_phone', 'status', 'notes', 'contract_start', 'contract_end', 'business_description', 'target_audience', 'offer_service', 'brand_voice', 'kpi_goals', 'competitors', 'location', 'onboarding_date', 'ai_notes']
    const update: any = {}
    for (const key of allowed) {
      if (key in body) {
        update[key] = body[key] === '' ? null : body[key]
      }
    }

    if (update.name) {
      update.slug = update.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    }

    if (update.monthly_retainer) update.monthly_retainer = parseFloat(update.monthly_retainer)
    if (update.rev_share_pct) update.rev_share_pct = parseFloat(update.rev_share_pct)

    const { data, error } = await supabaseAdmin
      .from('clients')
      .update(update)
      .eq('id', id)
      .eq('org_id', ORG_ID)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log activity
    await supabaseAdmin.from('activity_log').insert({
      org_id: ORG_ID,
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.email,
      action: 'updated',
      target_type: 'client',
      target_id: id,
      target_name: data.name,
      details: `Updated: ${Object.keys(update).join(', ')}`,
      client_id: id,
    })

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Get client name for activity log
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('name')
      .eq('id', id)
      .eq('org_id', ORG_ID)
      .single()

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Soft delete: set status to churned (or hard delete if no accounts)
    const { data: accounts } = await supabaseAdmin
      .from('ad_accounts')
      .select('id')
      .eq('org_id', ORG_ID)
      .eq('id', id)

    const { error } = await supabaseAdmin
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('org_id', ORG_ID)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin.from('activity_log').insert({
      org_id: ORG_ID,
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.email,
      action: 'deleted',
      target_type: 'client',
      target_name: client.name,
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
