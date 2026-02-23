import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, industry, website, monthly_retainer, rev_share_pct, primary_contact_name, primary_contact_email, status, notes } = body

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const { data, error } = await supabaseAdmin
      .from('clients')
      .insert({
        org_id: ORG_ID,
        name,
        slug,
        industry: industry || null,
        website: website || null,
        monthly_retainer: monthly_retainer ? parseFloat(monthly_retainer) : null,
        rev_share_pct: rev_share_pct ? parseFloat(rev_share_pct) : null,
        primary_contact_name: primary_contact_name || null,
        primary_contact_email: primary_contact_email || null,
        status: status || 'active',
        notes: notes || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
