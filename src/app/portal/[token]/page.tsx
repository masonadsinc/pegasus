import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { PortalDashboard } from './portal-dashboard'
import { isEcomActionType } from '@/lib/utils'

export const revalidate = 0

const ORG_ID = process.env.ADSINC_ORG_ID!

async function getPortalData(token: string) {
  // Look up client by portal token
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*, ad_accounts(*)')
    .eq('portal_token', token)
    .eq('org_id', ORG_ID)
    .single()

  if (!client) return null

  const account = (client.ad_accounts as any[])?.find((a: any) => a.is_active)
  if (!account) return null

  const isEcom = isEcomActionType(account.primary_action_type)

  // Date range — last 30 days, PST
  const now = new Date()
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const yesterday = new Date(pst); yesterday.setDate(pst.getDate() - 1)
  const start30 = new Date(yesterday); start30.setDate(yesterday.getDate() - 29)
  const start60 = new Date(yesterday); start60.setDate(yesterday.getDate() - 59)
  const yStr = yesterday.toISOString().split('T')[0]
  const d30Str = start30.toISOString().split('T')[0]
  const d60Str = start60.toISOString().split('T')[0]

  // Fetch data in parallel
  const [insightsRes, campaignRes, adInsightsRes] = await Promise.all([
    // Daily insights (60 days for comparison)
    supabaseAdmin
      .from('insights')
      .select('date, level, spend, impressions, clicks, reach, leads, purchases, purchase_value, schedules, landing_page_views')
      .eq('ad_account_id', account.id)
      .in('level', ['account', 'campaign'])
      .gte('date', d60Str)
      .lte('date', yStr)
      .order('date')
      .limit(2000),

    // Campaign insights (30 days)
    supabaseAdmin
      .from('insights')
      .select('platform_campaign_id, spend, impressions, clicks, leads, purchases, purchase_value, schedules')
      .eq('ad_account_id', account.id)
      .eq('level', 'campaign')
      .gte('date', d30Str)
      .lte('date', yStr)
      .limit(2000),

    // Ad insights (30 days)
    supabaseAdmin
      .from('insights')
      .select('platform_ad_id, spend, impressions, clicks, leads, purchases, schedules, purchase_value')
      .eq('ad_account_id', account.id)
      .eq('level', 'ad')
      .gte('date', d30Str)
      .lte('date', yStr)
      .limit(2000),
  ])

  // Name maps
  const [{ data: campaignEntities }, { data: adEntities }] = await Promise.all([
    supabaseAdmin.from('campaigns').select('platform_campaign_id, name').eq('ad_account_id', account.id),
    supabaseAdmin.from('ads').select('platform_ad_id, name, creative_url, creative_thumbnail_url, creative_headline').eq('ad_account_id', account.id),
  ])

  const campNameMap = new Map<string, string>()
  for (const c of (campaignEntities || [])) campNameMap.set(c.platform_campaign_id, c.name)
  const adNameMap = new Map<string, string>()
  const adCreativeMap = new Map<string, any>()
  for (const a of (adEntities || [])) {
    adNameMap.set(a.platform_ad_id, a.name)
    adCreativeMap.set(a.platform_ad_id, a)
  }

  // Process daily insights
  const hasAccountLevel = (insightsRes.data || []).some(i => i.level === 'account')
  let insights: any[]
  if (hasAccountLevel) {
    insights = (insightsRes.data || []).filter(i => i.level === 'account')
  } else {
    const byDate: Record<string, any> = {}
    for (const row of (insightsRes.data || []).filter(i => i.level === 'campaign')) {
      const d = typeof row.date === 'string' ? row.date : ''
      if (!byDate[d]) byDate[d] = { date: d, spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, purchases: 0, purchase_value: 0, schedules: 0, landing_page_views: 0 }
      byDate[d].spend += row.spend || 0
      byDate[d].impressions += row.impressions || 0
      byDate[d].clicks += row.clicks || 0
      byDate[d].reach += row.reach || 0
      byDate[d].leads += row.leads || 0
      byDate[d].purchases += row.purchases || 0
      byDate[d].purchase_value += row.purchase_value || 0
      byDate[d].schedules += row.schedules || 0
      byDate[d].landing_page_views += row.landing_page_views || 0
    }
    insights = Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date))
  }

  const thisMonth = insights.filter(i => i.date >= d30Str && i.date <= yStr)
  const lastMonth = insights.filter(i => i.date >= d60Str && i.date < d30Str)

  const agg = (rows: any[]) => rows.reduce((s, i) => ({
    spend: s.spend + (i.spend || 0),
    impressions: s.impressions + (i.impressions || 0),
    clicks: s.clicks + (i.clicks || 0),
    results: s.results + (i.leads || 0) + (i.purchases || 0) + (i.schedules || 0),
    revenue: s.revenue + (i.purchase_value || 0),
  }), { spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0 })

  const current = agg(thisMonth)
  const previous = agg(lastMonth)

  // Campaign breakdown
  const campaigns: any[] = []
  const campAgg: Record<string, any> = {}
  for (const ci of (campaignRes.data || [])) {
    const name = campNameMap.get(ci.platform_campaign_id) || ci.platform_campaign_id
    if (!campAgg[name]) campAgg[name] = { name, spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
    campAgg[name].spend += ci.spend || 0
    campAgg[name].results += (ci.leads || 0) + (ci.purchases || 0) + (ci.schedules || 0)
    campAgg[name].clicks += ci.clicks || 0
    campAgg[name].impressions += ci.impressions || 0
    campAgg[name].revenue += ci.purchase_value || 0
  }
  for (const c of Object.values(campAgg)) {
    campaigns.push({ ...c, cpr: c.results > 0 ? c.spend / c.results : 0, ctr: c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0 })
  }
  campaigns.sort((a, b) => b.spend - a.spend)

  // Top ads
  const adAgg: Record<string, any> = {}
  for (const ai of (adInsightsRes.data || [])) {
    const id = ai.platform_ad_id
    if (!adAgg[id]) adAgg[id] = { id, spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
    adAgg[id].spend += ai.spend || 0
    adAgg[id].results += (ai.leads || 0) + (ai.purchases || 0) + (ai.schedules || 0)
    adAgg[id].clicks += ai.clicks || 0
    adAgg[id].impressions += ai.impressions || 0
    adAgg[id].revenue += ai.purchase_value || 0
  }
  const topAds = Object.values(adAgg)
    .filter(a => a.results >= 1)
    .sort((a, b) => (a.spend / a.results) - (b.spend / b.results))
    .slice(0, 6)
    .map(a => {
      const creative = adCreativeMap.get(a.id)
      return {
        name: adNameMap.get(a.id) || a.id,
        imageUrl: creative?.creative_url || creative?.creative_thumbnail_url || null,
        headline: creative?.creative_headline || null,
        spend: a.spend,
        results: a.results,
        cpr: a.spend / a.results,
        ctr: a.impressions > 0 ? (a.clicks / a.impressions * 100) : 0,
      }
    })

  // Daily for chart
  const daily = thisMonth.map(d => ({
    date: d.date,
    spend: d.spend || 0,
    results: (d.leads || 0) + (d.purchases || 0) + (d.schedules || 0),
  }))

  const resultLabel = isEcom ? 'Purchases' : (account.primary_action_type === 'schedule' ? 'Schedules' : 'Leads')

  return {
    clientName: client.name,
    industry: client.industry,
    isEcom,
    resultLabel,
    targetCpl: account.target_cpl,
    targetRoas: account.target_roas,
    current,
    previous,
    campaigns,
    topAds,
    daily,
    lastUpdated: yStr,
  }
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const data = await getPortalData(token)
  if (!data) notFound()

  return <PortalDashboard {...data} />
}
