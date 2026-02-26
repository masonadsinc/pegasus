import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrgIdSync } from '@/lib/org'

const ORG_ID = getOrgIdSync()

// Public endpoint — returns non-sensitive org branding for nav/login
// No auth required (login page needs it before user is authenticated)
export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('organizations')
      .select('name, logo_url, primary_color')
      .eq('id', ORG_ID)
      .single()

    return NextResponse.json({
      name: data?.name || 'Agency',
      logo_url: data?.logo_url || null,
      primary_color: data?.primary_color || '#2563eb',
      initials: (data?.name || 'A').charAt(0).toUpperCase(),
    })
  } catch {
    return NextResponse.json({ name: 'Agency', logo_url: null, primary_color: '#2563eb', initials: 'A' })
  }
}
