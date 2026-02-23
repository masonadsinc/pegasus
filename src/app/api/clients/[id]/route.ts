import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // Only allow these fields to be updated
    const allowed = ['name', 'industry', 'website', 'monthly_retainer', 'rev_share_pct', 'primary_contact_name', 'primary_contact_email', 'status', 'notes', 'contract_start', 'contract_end']
    const update: any = {}
    for (const key of allowed) {
      if (key in body) {
        update[key] = body[key] === '' ? null : body[key]
      }
    }

    // Auto-update slug if name changes
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
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
