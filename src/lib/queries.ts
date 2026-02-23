import { supabaseAdmin } from './supabase'

export interface AccountSummary {
  client_name: string
  client_slug: string
  account_name: string
  ad_account_id: string
  objective: string
  target_cpl: number | null
  target_roas: number | null
  spend: number
  impressions: number
  clicks: number
  leads: number
  purchases: number
  purchase_value: number
  landing_page_views: number
  inline_link_clicks: number
}

export async function getDashboardData(orgId: string, days: number = 7) {
  // Get daily account summaries from insights
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  const dateStr = daysAgo.toISOString().split('T')[0]

  const { data: insights, error } = await supabaseAdmin
    .from('insights')
    .select(`
      ad_account_id,
      date,
      spend,
      impressions,
      clicks,
      inline_link_clicks,
      outbound_clicks,
      landing_page_views,
      leads,
      purchases,
      purchase_value,
      schedules,
      reach
    `)
    .eq('org_id', orgId)
    .eq('level', 'ad')
    .gte('date', dateStr)
    .order('date', { ascending: false })

  if (error) throw error

  // Get account + client info
  const { data: accounts, error: accError } = await supabaseAdmin
    .from('ad_accounts')
    .select(`
      id,
      name,
      platform_account_id,
      objective,
      target_cpl,
      target_roas,
      clients!inner(name, slug, status)
    `)
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (accError) throw accError

  // Build account map
  const accountMap = new Map<string, any>()
  for (const a of accounts || []) {
    accountMap.set(a.id, a)
  }

  // Aggregate per account
  const accountTotals = new Map<string, AccountSummary>()
  
  for (const row of insights || []) {
    const account = accountMap.get(row.ad_account_id)
    if (!account) continue
    const client = (account.clients as any)

    const key = row.ad_account_id
    const existing = accountTotals.get(key) || {
      client_name: client.name,
      client_slug: client.slug,
      account_name: account.name,
      ad_account_id: row.ad_account_id,
      objective: account.objective,
      target_cpl: account.target_cpl,
      target_roas: account.target_roas,
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      purchases: 0,
      purchase_value: 0,
      landing_page_views: 0,
      inline_link_clicks: 0,
    }

    existing.spend += parseFloat(row.spend) || 0
    existing.impressions += row.impressions || 0
    existing.clicks += row.clicks || 0
    existing.leads += row.leads || 0
    existing.purchases += row.purchases || 0
    existing.purchase_value += parseFloat(row.purchase_value) || 0
    existing.landing_page_views += row.landing_page_views || 0
    existing.inline_link_clicks += row.inline_link_clicks || 0

    accountTotals.set(key, existing)
  }

  return Array.from(accountTotals.values()).sort((a, b) => b.spend - a.spend)
}

export async function getDailyTrend(orgId: string, accountId: string, days: number = 30) {
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  const dateStr = daysAgo.toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .rpc('get_daily_account_summary', { 
      p_org_id: orgId, 
      p_account_id: accountId, 
      p_start_date: dateStr 
    })

  if (error) {
    // Fallback: direct query
    const { data: insights, error: e2 } = await supabaseAdmin
      .from('insights')
      .select('date, spend, leads, purchases, purchase_value, impressions, clicks, landing_page_views')
      .eq('ad_account_id', accountId)
      .eq('level', 'ad')
      .gte('date', dateStr)
      .order('date')

    if (e2) throw e2

    // Aggregate by date
    const byDate = new Map<string, any>()
    for (const r of insights || []) {
      const d = r.date
      const existing = byDate.get(d) || { date: d, spend: 0, leads: 0, purchases: 0, purchase_value: 0, impressions: 0, clicks: 0, landing_page_views: 0 }
      existing.spend += parseFloat(r.spend) || 0
      existing.leads += r.leads || 0
      existing.purchases += r.purchases || 0
      existing.purchase_value += parseFloat(r.purchase_value) || 0
      existing.impressions += r.impressions || 0
      existing.clicks += r.clicks || 0
      existing.landing_page_views += r.landing_page_views || 0
      byDate.set(d, existing)
    }
    return Array.from(byDate.values())
  }

  return data
}
