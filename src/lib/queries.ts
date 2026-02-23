import { supabaseAdmin } from './supabase'

export interface AccountSummary {
  client_name: string
  client_slug: string
  account_name: string
  ad_account_id: string
  platform_account_id: string
  objective: string
  primary_action_type: string | null
  target_cpl: number | null
  target_roas: number | null
  spend: number
  impressions: number
  clicks: number
  reach: number
  leads: number
  purchases: number
  purchase_value: number
  schedules: number
  landing_page_views: number
  inline_link_clicks: number
  results: number
  result_label: string
  daily: DailyMetric[]
}

export interface DailyMetric {
  date: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  purchases: number
  purchase_value: number
  schedules: number
  landing_page_views: number
  results: number
}

export interface CampaignRow {
  platform_campaign_id: string
  campaign_name: string
  spend: number
  impressions: number
  clicks: number
  results: number
  result_label: string
  cpr: number
  ctr: number
  landing_page_views: number
}

export interface AdRow {
  platform_ad_id: string
  ad_name: string
  platform_campaign_id: string
  campaign_name: string
  spend: number
  impressions: number
  clicks: number
  results: number
  result_label: string
  cpr: number
  ctr: number
  landing_page_views: number
  creative_url: string | null
  creative_thumbnail_url: string | null
  creative_video_url: string | null
  creative_body: string | null
  creative_headline: string | null
  creative_cta: string | null
  effective_status: string | null
}

export interface AdSetRow {
  platform_ad_set_id: string
  ad_set_name: string
  platform_campaign_id: string
  campaign_name: string
  status: string | null
  daily_budget: number | null
  optimization_goal: string | null
  spend: number
  impressions: number
  clicks: number
  results: number
  result_label: string
  cpr: number
  ctr: number
}

export interface BreakdownRow {
  dimension_value: string
  spend: number
  impressions: number
  clicks: number
  results: number
  cpr: number
  ctr: number
}

function deriveResults(row: any, primaryActionType: string | null): { results: number; result_label: string } {
  const pat = primaryActionType || ''
  if (pat === 'schedule_total') {
    return { results: row.schedules || 0, result_label: 'schedules' }
  } else if (['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'].includes(pat)) {
    return { results: row.purchases || 0, result_label: 'purchases' }
  } else {
    return { results: row.leads || 0, result_label: pat.includes('fb_pixel_custom') ? 'calls' : 'leads' }
  }
}

const ORG_ID = process.env.ADSINC_ORG_ID!

// ─── Dashboard ────────────────────────────────────────────────

export async function getDashboardData(orgId: string, days: number = 7): Promise<AccountSummary[]> {
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  const dateStr = daysAgo.toISOString().split('T')[0]

  const { data: insights, error } = await supabaseAdmin
    .from('insights')
    .select('ad_account_id, date, spend, impressions, clicks, reach, inline_link_clicks, landing_page_views, leads, purchases, purchase_value, schedules')
    .eq('org_id', orgId)
    .eq('level', 'campaign')
    .gte('date', dateStr)
    .order('date', { ascending: true })

  if (error) throw error

  const { data: accounts, error: accError } = await supabaseAdmin
    .from('ad_accounts')
    .select('id, name, platform_account_id, objective, primary_action_type, target_cpl, target_roas, clients!inner(name, slug, status)')
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (accError) throw accError

  const accountMap = new Map<string, any>()
  for (const a of accounts || []) accountMap.set(a.id, a)

  const accountTotals = new Map<string, AccountSummary>()
  const accountDaily = new Map<string, Map<string, DailyMetric>>()

  for (const row of insights || []) {
    const account = accountMap.get(row.ad_account_id)
    if (!account) continue
    const client = account.clients as any
    const { results: rowResults } = deriveResults(row, account.primary_action_type)

    const key = row.ad_account_id
    const existing = accountTotals.get(key) || {
      client_name: client.name, client_slug: client.slug, account_name: account.name,
      ad_account_id: row.ad_account_id, platform_account_id: account.platform_account_id,
      objective: account.objective, primary_action_type: account.primary_action_type,
      target_cpl: account.target_cpl, target_roas: account.target_roas,
      spend: 0, impressions: 0, clicks: 0, reach: 0,
      leads: 0, purchases: 0, purchase_value: 0, schedules: 0,
      landing_page_views: 0, inline_link_clicks: 0,
      results: 0, result_label: 'leads', daily: [],
    }

    existing.spend += parseFloat(row.spend) || 0
    existing.impressions += row.impressions || 0
    existing.clicks += row.clicks || 0
    existing.reach += row.reach || 0
    existing.leads += row.leads || 0
    existing.purchases += row.purchases || 0
    existing.purchase_value += parseFloat(row.purchase_value) || 0
    existing.schedules += row.schedules || 0
    existing.landing_page_views += row.landing_page_views || 0
    existing.inline_link_clicks += row.inline_link_clicks || 0
    existing.results += rowResults
    accountTotals.set(key, existing)

    if (!accountDaily.has(key)) accountDaily.set(key, new Map())
    const dailyMap = accountDaily.get(key)!
    const d = row.date
    const day = dailyMap.get(d) || { date: d, spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, purchase_value: 0, schedules: 0, landing_page_views: 0, results: 0 }
    day.spend += parseFloat(row.spend) || 0
    day.impressions += row.impressions || 0
    day.clicks += row.clicks || 0
    day.leads += row.leads || 0
    day.purchases += row.purchases || 0
    day.purchase_value += parseFloat(row.purchase_value) || 0
    day.schedules += row.schedules || 0
    day.landing_page_views += row.landing_page_views || 0
    day.results += rowResults
    dailyMap.set(d, day)
  }

  for (const [key, acct] of accountTotals) {
    const pat = acct.primary_action_type || ''
    if (pat === 'schedule_total') acct.result_label = 'schedules'
    else if (['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'].includes(pat)) acct.result_label = 'purchases'
    else acct.result_label = pat.includes('fb_pixel_custom') ? 'calls' : 'leads'
    const dailyMap = accountDaily.get(key)
    acct.daily = dailyMap ? Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)) : []
  }

  return Array.from(accountTotals.values()).sort((a, b) => b.spend - a.spend)
}

// ─── Client Detail ────────────────────────────────────────────

export async function getClientBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug, industry, status, ad_accounts(id, name, platform_account_id, objective, primary_action_type, target_cpl, target_roas, is_active, last_synced_at)')
    .eq('org_id', ORG_ID)
    .eq('slug', slug)
    .single()
  if (error) throw error
  return data
}

export async function getClientInsights(accountId: string, days: number = 30, primaryActionType: string | null = null) {
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  const dateStr = daysAgo.toISOString().split('T')[0]

  const { data: daily, error } = await supabaseAdmin
    .from('insights')
    .select('date, spend, impressions, clicks, reach, leads, purchases, purchase_value, schedules, landing_page_views, inline_link_clicks')
    .eq('ad_account_id', accountId)
    .eq('level', 'campaign')
    .gte('date', dateStr)
    .order('date')

  if (error) throw error

  const byDate = new Map<string, DailyMetric>()
  for (const r of daily || []) {
    const d = r.date
    const { results } = deriveResults(r, primaryActionType)
    const existing = byDate.get(d) || { date: d, spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, purchase_value: 0, schedules: 0, landing_page_views: 0, results: 0 }
    existing.spend += parseFloat(r.spend) || 0
    existing.impressions += r.impressions || 0
    existing.clicks += r.clicks || 0
    existing.leads += r.leads || 0
    existing.purchases += r.purchases || 0
    existing.purchase_value += parseFloat(r.purchase_value) || 0
    existing.schedules += r.schedules || 0
    existing.landing_page_views += r.landing_page_views || 0
    existing.results += results
    byDate.set(d, existing)
  }
  return Array.from(byDate.values())
}

export async function getCampaignBreakdown(accountId: string, days: number = 30, primaryActionType: string | null = null): Promise<CampaignRow[]> {
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  const dateStr = daysAgo.toISOString().split('T')[0]

  // Get insights at campaign level
  const { data, error } = await supabaseAdmin
    .from('insights')
    .select('platform_campaign_id, spend, impressions, clicks, leads, purchases, purchase_value, schedules, landing_page_views')
    .eq('ad_account_id', accountId)
    .eq('level', 'campaign')
    .gte('date', dateStr)

  if (error) throw error

  // Get campaign names
  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('platform_campaign_id, name')
    .eq('ad_account_id', accountId)

  const nameMap = new Map<string, string>()
  for (const c of campaigns || []) nameMap.set(c.platform_campaign_id, c.name || 'Unknown')

  const { result_label } = deriveResults({ leads: 0, purchases: 0, schedules: 0 }, primaryActionType)
  const map = new Map<string, CampaignRow>()
  for (const r of data || []) {
    const key = r.platform_campaign_id
    const { results } = deriveResults(r, primaryActionType)
    const existing = map.get(key) || {
      platform_campaign_id: r.platform_campaign_id,
      campaign_name: nameMap.get(r.platform_campaign_id) || r.platform_campaign_id,
      spend: 0, impressions: 0, clicks: 0, results: 0, result_label, cpr: 0, ctr: 0, landing_page_views: 0,
    }
    existing.spend += parseFloat(r.spend) || 0
    existing.impressions += r.impressions || 0
    existing.clicks += r.clicks || 0
    existing.results += results
    existing.landing_page_views += r.landing_page_views || 0
    map.set(key, existing)
  }

  return Array.from(map.values()).map(c => ({
    ...c,
    cpr: c.results > 0 ? c.spend / c.results : 0,
    ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
  })).sort((a, b) => b.spend - a.spend)
}

export async function getAdSetBreakdown(accountId: string, days: number = 30, primaryActionType: string | null = null): Promise<AdSetRow[]> {
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  const dateStr = daysAgo.toISOString().split('T')[0]

  // Get ad-level insights (we don't have adset-level insights, so we aggregate from ad level)
  const { data, error } = await supabaseAdmin
    .from('insights')
    .select('platform_ad_set_id, platform_campaign_id, spend, impressions, clicks, leads, purchases, purchase_value, schedules, landing_page_views')
    .eq('ad_account_id', accountId)
    .eq('level', 'ad')
    .gte('date', dateStr)

  if (error) throw error

  // Get ad set metadata
  const { data: adSets } = await supabaseAdmin
    .from('ad_sets')
    .select('platform_ad_set_id, name, status, daily_budget, optimization_goal, campaign_id')
    .eq('ad_account_id', accountId)

  // Get campaigns for names
  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id, platform_campaign_id, name')
    .eq('ad_account_id', accountId)

  const adSetMap = new Map<string, any>()
  for (const a of adSets || []) adSetMap.set(a.platform_ad_set_id, a)
  const campNameMap = new Map<string, string>()
  const campIdToPlat = new Map<string, string>()
  for (const c of campaigns || []) {
    campNameMap.set(c.platform_campaign_id, c.name || 'Unknown')
    campIdToPlat.set(c.id, c.platform_campaign_id)
  }

  const { result_label } = deriveResults({ leads: 0, purchases: 0, schedules: 0 }, primaryActionType)
  const map = new Map<string, AdSetRow>()
  for (const r of data || []) {
    const key = r.platform_ad_set_id
    if (!key) continue
    const { results } = deriveResults(r, primaryActionType)
    const meta = adSetMap.get(key)
    const platCampId = r.platform_campaign_id || (meta?.campaign_id ? campIdToPlat.get(meta.campaign_id) : null) || ''
    const existing = map.get(key) || {
      platform_ad_set_id: key,
      ad_set_name: meta?.name || key,
      platform_campaign_id: platCampId,
      campaign_name: campNameMap.get(platCampId) || platCampId,
      status: meta?.status || null,
      daily_budget: meta?.daily_budget ? parseFloat(meta.daily_budget) : null,
      optimization_goal: meta?.optimization_goal || null,
      spend: 0, impressions: 0, clicks: 0, results: 0, result_label, cpr: 0, ctr: 0,
    }
    existing.spend += parseFloat(r.spend) || 0
    existing.impressions += r.impressions || 0
    existing.clicks += r.clicks || 0
    existing.results += results
    map.set(key, existing)
  }

  return Array.from(map.values()).map(a => ({
    ...a,
    cpr: a.results > 0 ? a.spend / a.results : 0,
    ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
  })).sort((a, b) => b.spend - a.spend)
}

export async function getAdBreakdown(accountId: string, days: number = 30, primaryActionType: string | null = null): Promise<AdRow[]> {
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  const dateStr = daysAgo.toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('insights')
    .select('platform_ad_id, platform_campaign_id, spend, impressions, clicks, leads, purchases, purchase_value, schedules, landing_page_views')
    .eq('ad_account_id', accountId)
    .eq('level', 'ad')
    .gte('date', dateStr)

  if (error) throw error

  // Get ad + campaign names
  const { data: ads } = await supabaseAdmin.from('ads').select('platform_ad_id, name, creative_url, creative_thumbnail_url, creative_video_url, creative_body, creative_headline, creative_cta, effective_status').eq('ad_account_id', accountId)
  const { data: campaigns } = await supabaseAdmin.from('campaigns').select('platform_campaign_id, name').eq('ad_account_id', accountId)

  const adMap = new Map<string, any>()
  for (const a of ads || []) adMap.set(a.platform_ad_id, a)
  const adNames = new Map<string, string>()
  for (const a of ads || []) adNames.set(a.platform_ad_id, a.name || 'Unknown')
  const campNames = new Map<string, string>()
  for (const c of campaigns || []) campNames.set(c.platform_campaign_id, c.name || 'Unknown')

  const { result_label } = deriveResults({ leads: 0, purchases: 0, schedules: 0 }, primaryActionType)
  const map = new Map<string, AdRow>()
  for (const r of data || []) {
    const key = r.platform_ad_id
    if (!key) continue
    const { results } = deriveResults(r, primaryActionType)
    const adInfo = adMap.get(r.platform_ad_id)
    const existing = map.get(key) || {
      platform_ad_id: r.platform_ad_id,
      ad_name: adNames.get(r.platform_ad_id) || r.platform_ad_id,
      platform_campaign_id: r.platform_campaign_id,
      campaign_name: campNames.get(r.platform_campaign_id) || r.platform_campaign_id,
      spend: 0, impressions: 0, clicks: 0, results: 0, result_label, cpr: 0, ctr: 0, landing_page_views: 0,
      creative_url: adInfo?.creative_url || null,
      creative_thumbnail_url: adInfo?.creative_thumbnail_url || null,
      creative_video_url: adInfo?.creative_video_url || null,
      creative_body: adInfo?.creative_body || null,
      creative_headline: adInfo?.creative_headline || null,
      creative_cta: adInfo?.creative_cta || null,
      effective_status: adInfo?.effective_status || null,
    }
    existing.spend += parseFloat(r.spend) || 0
    existing.impressions += r.impressions || 0
    existing.clicks += r.clicks || 0
    existing.results += results
    existing.landing_page_views += r.landing_page_views || 0
    map.set(key, existing)
  }

  return Array.from(map.values()).map(a => ({
    ...a,
    cpr: a.results > 0 ? a.spend / a.results : 0,
    ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
  })).sort((a, b) => b.spend - a.spend)
}

export async function getBreakdownData(accountId: string, breakdownType: string, days: number = 30, primaryActionType: string | null = null): Promise<BreakdownRow[]> {
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  const dateStr = daysAgo.toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('insight_breakdowns')
    .select('dimension_1, dimension_2, spend, impressions, clicks, leads, purchases, purchase_value')
    .eq('ad_account_id', accountId)
    .eq('breakdown_type', breakdownType)
    .gte('date', dateStr)

  if (error) throw error

  const map = new Map<string, BreakdownRow>()
  for (const r of data || []) {
    const key = [r.dimension_1, r.dimension_2].filter(Boolean).join(' · ') || 'Unknown'
    const { results } = deriveResults({ ...r, schedules: 0 }, primaryActionType)
    const existing = map.get(key) || { dimension_value: key, spend: 0, impressions: 0, clicks: 0, results: 0, cpr: 0, ctr: 0 }
    existing.spend += parseFloat(r.spend) || 0
    existing.impressions += r.impressions || 0
    existing.clicks += r.clicks || 0
    existing.results += results
    map.set(key, existing)
  }

  return Array.from(map.values()).map(b => ({
    ...b,
    cpr: b.results > 0 ? b.spend / b.results : 0,
    ctr: b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0,
  })).sort((a, b) => b.spend - a.spend)
}
