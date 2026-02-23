import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accountId = req.nextUrl.searchParams.get('account_id')
    const type = req.nextUrl.searchParams.get('type') || 'daily'
    const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('days') || '30') || 30, 1), 365)

    if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 })

    // Verify account belongs to org
    const { data: account } = await supabaseAdmin
      .from('ad_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('org_id', process.env.ADSINC_ORG_ID!)
      .single()
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - days)
    const dateStr = daysAgo.toISOString().split('T')[0]

    let csv = ''

    if (type === 'daily') {
      const { data, error } = await supabaseAdmin
        .from('insights')
        .select('date, spend, impressions, clicks, leads, purchases, purchase_value, schedules, landing_page_views')
        .eq('ad_account_id', accountId)
        .eq('level', 'account')
        .gte('date', dateStr)
        .order('date', { ascending: true })
        .limit(500)

      if (error) throw error

      csv = 'Date,Spend,Impressions,Clicks,Leads,Purchases,Purchase Value,Schedules,Landing Page Views\n'
      for (const r of data || []) {
        csv += `${r.date},${r.spend},${r.impressions},${r.clicks},${r.leads},${r.purchases},${r.purchase_value},${r.schedules},${r.landing_page_views}\n`
      }
    } else if (type === 'ads') {
      const { data: insights, error } = await supabaseAdmin
        .from('insights')
        .select('platform_ad_id, spend, impressions, clicks, leads, purchases, purchase_value')
        .eq('ad_account_id', accountId)
        .eq('level', 'ad')
        .gte('date', dateStr)
        .limit(10000)

      if (error) throw error

      const { data: ads } = await supabaseAdmin.from('ads').select('platform_ad_id, name, effective_status').eq('ad_account_id', accountId)
      const adNames = new Map<string, any>()
      for (const a of ads || []) adNames.set(a.platform_ad_id, a)

      const map = new Map<string, any>()
      for (const r of insights || []) {
        const key = r.platform_ad_id
        if (!key) continue
        const existing = map.get(key) || { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, purchase_value: 0 }
        existing.spend += parseFloat(r.spend) || 0
        existing.impressions += r.impressions || 0
        existing.clicks += r.clicks || 0
        existing.leads += r.leads || 0
        existing.purchases += r.purchases || 0
        existing.purchase_value += parseFloat(r.purchase_value) || 0
        map.set(key, existing)
      }

      csv = 'Ad ID,Ad Name,Status,Spend,Impressions,Clicks,Leads,Purchases,Purchase Value,CTR\n'
      for (const [id, m] of Array.from(map.entries()).sort((a, b) => b[1].spend - a[1].spend)) {
        const info = adNames.get(id)
        const ctr = m.impressions > 0 ? ((m.clicks / m.impressions) * 100).toFixed(2) : '0'
        csv += `${id},"${(info?.name || '').replace(/"/g, '""')}",${info?.effective_status || ''},${m.spend.toFixed(2)},${m.impressions},${m.clicks},${m.leads},${m.purchases},${m.purchase_value.toFixed(2)},${ctr}\n`
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${type}-export-${days}d.csv"`,
      },
    })
  } catch (e: any) {
    console.error('Export API error:', e)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
