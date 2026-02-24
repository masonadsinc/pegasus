import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'

const ORG_ID = process.env.ADSINC_ORG_ID!

// GET /api/reports?week=2026-W08
export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const week = req.nextUrl.searchParams.get('week')

  let query = supabaseAdmin
    .from('weekly_reports')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('client_name')

  if (week) {
    query = query.eq('week', week)
  } else {
    // Get distinct weeks for the week picker
    const { data: weeks } = await supabaseAdmin
      .from('weekly_reports')
      .select('week')
      .eq('org_id', ORG_ID)
      .order('week', { ascending: false })
      .limit(52)

    const uniqueWeeks = [...new Set((weeks || []).map(w => w.week))]
    return NextResponse.json({ weeks: uniqueWeeks })
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data })
}
