import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { getOrgId } from '@/lib/org'


export async function GET(req: NextRequest) {
  const ORG_ID = await getOrgId()
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('days') || '7') || 7, 1), 90)
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - days)
    const dateStr = daysAgo.toISOString().split('T')[0]

    // Get all active accounts with client names
    const { data: accounts } = await supabaseAdmin
      .from('ad_accounts')
      .select('id, name, platform_account_id, primary_action_type, target_cpl, target_roas, clients!inner(name)')
      .eq('org_id', ORG_ID)
      .eq('is_active', true)

    if (!accounts?.length) return NextResponse.json({ error: 'No accounts found' }, { status: 404 })

    // Get insights for all accounts
    const { data: insights } = await supabaseAdmin
      .from('insights')
      .select('ad_account_id, date, spend, impressions, clicks, leads, purchases, purchase_value, schedules, landing_page_views')
      .eq('level', 'account')
      .gte('date', dateStr)
      .in('ad_account_id', accounts.map(a => a.id))
      .order('date', { ascending: true })
      .limit(5000)

    const accountMap = new Map(accounts.map(a => [a.id, a]))

    let csv = 'Client,Account,Date,Spend,Impressions,Clicks,Leads,Purchases,Purchase Value,Schedules,LPV,CTR,CPC\n'

    for (const r of insights || []) {
      const acc = accountMap.get(r.ad_account_id)
      if (!acc) continue
      const ctr = r.impressions > 0 ? ((r.clicks / r.impressions) * 100).toFixed(2) : '0'
      const cpc = r.clicks > 0 ? (r.spend / r.clicks).toFixed(2) : '0'
      csv += `"${(acc.clients as any).name}","${acc.name}",${r.date},${r.spend},${r.impressions},${r.clicks},${r.leads},${r.purchases},${r.purchase_value},${r.schedules},${r.landing_page_views},${ctr},${cpc}\n`
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="all-accounts-${days}d.csv"`,
      },
    })
  } catch (e: any) {
    console.error('Export-all error:', e)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
