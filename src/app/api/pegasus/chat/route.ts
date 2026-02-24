import { NextRequest } from 'next/server'
import { getUser, getUserOrgRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isEcomActionType } from '@/lib/utils'
import { preAnalyze, analyzeAudience } from '@/lib/analysis'

const ORG_ID = process.env.ADSINC_ORG_ID!

async function getOrgGeminiKey() {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('gemini_api_key')
    .eq('id', ORG_ID)
    .single()
  const stored = data?.gemini_api_key
  return stored || process.env.GEMINI_API_KEY || null
}

async function getClientContext(clientId: string, days = 7) {
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*, ad_accounts(*)')
    .eq('org_id', ORG_ID)
    .eq('id', clientId)
    .single()

  if (!client) return null

  const account = (client.ad_accounts as any[])?.find((a: any) => a.is_active)
  if (!account) return { client, context: `${client.name}: No active ad account.` }

  const isEcom = isEcomActionType(account.primary_action_type)

  // Date calculations in PST
  const now = new Date()
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const yesterday = new Date(pst); yesterday.setDate(pst.getDate() - 1)
  const daysAgo = new Date(yesterday); daysAgo.setDate(yesterday.getDate() - (days - 1))
  const prevEnd = new Date(daysAgo); prevEnd.setDate(daysAgo.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - (days - 1))
  const yStr = yesterday.toISOString().split('T')[0]
  const dStr = daysAgo.toISOString().split('T')[0]
  const pEnd = prevEnd.toISOString().split('T')[0]
  const pStart = prevStart.toISOString().split('T')[0]

  // Parallel data fetches for speed
  const [insightsRes, campaignRes, adInsightsRes, adSetInsightsRes, activeAdsRes, ageGenderRes, placementRes] = await Promise.all([
    // Account-level daily insights (current + previous period)
    // Try account level first; will fall back to campaign if empty
    supabaseAdmin
      .from('insights')
      .select('date, level, spend, impressions, clicks, leads, purchases, purchase_value, schedules, landing_page_views')
      .eq('ad_account_id', account.id)
      .in('level', ['account', 'campaign'])
      .gte('date', pStart)
      .lte('date', yStr)
      .order('date')
      .limit(2000),

    // Campaign-level insights (current period)
    supabaseAdmin
      .from('insights')
      .select('campaign_name, spend, impressions, clicks, leads, purchases, purchase_value, schedules')
      .eq('ad_account_id', account.id)
      .eq('level', 'campaign')
      .gte('date', dStr)
      .lte('date', yStr)
      .limit(2000),

    // Ad-level insights (current period) — for performance ranking
    supabaseAdmin
      .from('insights')
      .select('ad_name, campaign_name, ad_set_name, spend, impressions, clicks, leads, purchases, schedules, purchase_value')
      .eq('ad_account_id', account.id)
      .eq('level', 'ad')
      .gte('date', dStr)
      .lte('date', yStr)
      .limit(5000),

    // Ad set level insights (current period)
    supabaseAdmin
      .from('insights')
      .select('ad_set_name, campaign_name, spend, impressions, clicks, leads, purchases, schedules, purchase_value')
      .eq('ad_account_id', account.id)
      .eq('level', 'adset')
      .gte('date', dStr)
      .lte('date', yStr)
      .limit(2000),

    // Active ads with creative info
    supabaseAdmin
      .from('ads')
      .select('name, campaign_name, ad_set_name, creative_headline, creative_body, creative_cta, creative_url, effective_status')
      .eq('ad_account_id', account.id)
      .in('effective_status', ['ACTIVE', 'PAUSED'])
      .limit(100),

    // Age/gender breakdown
    supabaseAdmin
      .from('insight_breakdowns')
      .select('dimension_1, dimension_2, spend, impressions, clicks, leads, purchases, purchase_value')
      .eq('ad_account_id', account.id)
      .eq('breakdown_type', 'age_gender')
      .gte('date', dStr)
      .lte('date', yStr)
      .limit(500),

    // Placement breakdown
    supabaseAdmin
      .from('insight_breakdowns')
      .select('dimension_1, dimension_2, spend, impressions, clicks, leads, purchases, purchase_value')
      .eq('ad_account_id', account.id)
      .eq('breakdown_type', 'placement')
      .gte('date', dStr)
      .lte('date', yStr)
      .limit(500),
  ])

  const rawInsights = insightsRes.data || []
  // Prefer account-level data; fall back to campaign-level aggregated by date
  const hasAccountLevel = rawInsights.some(i => i.level === 'account')
  let insights: any[]
  if (hasAccountLevel) {
    insights = rawInsights.filter(i => i.level === 'account')
  } else {
    // Aggregate campaign-level rows by date
    const byDate: Record<string, any> = {}
    for (const row of rawInsights.filter(i => i.level === 'campaign')) {
      const d = typeof row.date === 'string' ? row.date : row.date?.toISOString?.()?.split('T')[0] || ''
      if (!byDate[d]) byDate[d] = { date: d, spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, purchase_value: 0, schedules: 0, landing_page_views: 0 }
      byDate[d].spend += row.spend || 0
      byDate[d].impressions += row.impressions || 0
      byDate[d].clicks += row.clicks || 0
      byDate[d].leads += row.leads || 0
      byDate[d].purchases += row.purchases || 0
      byDate[d].purchase_value += row.purchase_value || 0
      byDate[d].schedules += row.schedules || 0
      byDate[d].landing_page_views += row.landing_page_views || 0
    }
    insights = Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date))
  }
  const toDateStr = (d: any) => typeof d === 'string' ? d.split('T')[0] : d?.toISOString?.()?.split('T')[0] || ''
  const thisWeek = insights.filter(i => { const ds = toDateStr(i.date); return ds >= dStr && ds <= yStr })
  const lastWeek = insights.filter(i => { const ds = toDateStr(i.date); return ds >= pStart && ds <= pEnd })

  const agg = (rows: any[]) => rows.reduce((s, i) => ({
    spend: s.spend + (i.spend || 0),
    impressions: s.impressions + (i.impressions || 0),
    clicks: s.clicks + (i.clicks || 0),
    results: s.results + (i.leads || 0) + (i.purchases || 0) + (i.schedules || 0),
    revenue: s.revenue + (i.purchase_value || 0),
    lpv: s.lpv + (i.landing_page_views || 0),
  }), { spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0, lpv: 0 })

  const tw = agg(thisWeek)
  const lw = agg(lastWeek)

  // Aggregate campaign data
  const campaigns: Record<string, any> = {}
  for (const ci of (campaignRes.data || [])) {
    const name = ci.campaign_name || 'Unknown'
    if (!campaigns[name]) campaigns[name] = { spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
    campaigns[name].spend += ci.spend || 0
    campaigns[name].results += (ci.leads || 0) + (ci.purchases || 0) + (ci.schedules || 0)
    campaigns[name].clicks += ci.clicks || 0
    campaigns[name].impressions += ci.impressions || 0
    campaigns[name].revenue += ci.purchase_value || 0
  }

  // Aggregate ad set data
  const adSets: Record<string, any> = {}
  for (const as of (adSetInsightsRes.data || [])) {
    const name = as.ad_set_name || 'Unknown'
    if (!adSets[name]) adSets[name] = { campaign: as.campaign_name, spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
    adSets[name].spend += as.spend || 0
    adSets[name].results += (as.leads || 0) + (as.purchases || 0) + (as.schedules || 0)
    adSets[name].clicks += as.clicks || 0
    adSets[name].impressions += as.impressions || 0
    adSets[name].revenue += as.purchase_value || 0
  }

  // Aggregate ad-level data
  const ads: Record<string, any> = {}
  for (const ai of (adInsightsRes.data || [])) {
    const name = ai.ad_name || 'Unknown'
    if (!ads[name]) ads[name] = { campaign: ai.campaign_name, adSet: ai.ad_set_name, spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
    ads[name].spend += ai.spend || 0
    ads[name].results += (ai.leads || 0) + (ai.purchases || 0) + (ai.schedules || 0)
    ads[name].clicks += ai.clicks || 0
    ads[name].impressions += ai.impressions || 0
    ads[name].revenue += ai.purchase_value || 0
  }

  // Creative lookup map from active ads
  const creativeMap = new Map<string, any>()
  for (const ad of (activeAdsRes.data || [])) {
    creativeMap.set(ad.name, ad)
  }

  const sortedAds = Object.entries(ads).sort((a, b) => b[1].spend - a[1].spend)
  const targetCpl = account.target_cpl || (tw.results > 0 ? tw.spend / tw.results * 1.5 : 50)

  // Categorize ads
  const topPerformers = sortedAds
    .filter(([, d]) => d.results >= 2)
    .sort((a, b) => (a[1].spend / a[1].results) - (b[1].spend / b[1].results))
    .slice(0, 5)
  const nonConverting = sortedAds.filter(([, d]) => d.results === 0 && d.spend > targetCpl * 0.75)
  const highCost = sortedAds
    .filter(([, d]) => d.results > 0 && (d.spend / d.results) > targetCpl * 1.5)
    .sort((a, b) => (b[1].spend / b[1].results) - (a[1].spend / a[1].results))
    .slice(0, 5)

  // Derived metrics
  const cpr = tw.results > 0 ? tw.spend / tw.results : 0
  const lwCpr = lw.results > 0 ? lw.spend / lw.results : 0
  const ctr = tw.impressions > 0 ? (tw.clicks / tw.impressions * 100) : 0
  const cpc = tw.clicks > 0 ? tw.spend / tw.clicks : 0
  const convRate = tw.clicks > 0 ? (tw.results / tw.clicks * 100) : 0
  const roas = tw.spend > 0 ? tw.revenue / tw.spend : 0
  const freq = tw.impressions > 0 && tw.clicks > 0 ? tw.impressions / (tw.impressions / (tw.clicks / ctr * 100)) : 0

  // ===== BUILD CONTEXT =====
  let ctx = `# ${client.name} — Performance Analysis\n`
  ctx += `Data: ${dStr} to ${yStr} (${days} days) vs previous ${days} days (${pStart} to ${pEnd})\n\n`

  // Client profile
  ctx += `## Client Profile\n`
  ctx += `- Industry: ${client.industry || 'N/A'} | Location: ${client.location || 'N/A'}\n`
  ctx += `- Status: ${client.status} | Retainer: $${client.monthly_retainer || 0}/mo\n`
  ctx += `- Metric: ${isEcom ? 'ROAS (e-commerce)' : 'CPL (lead gen)'}\n`
  if (client.business_description) ctx += `- Business: ${client.business_description}\n`
  if (client.offer_service) ctx += `- Offer: ${client.offer_service}\n`
  if (client.target_audience) ctx += `- Target audience: ${client.target_audience}\n`
  if (client.brand_voice) ctx += `- Brand voice: ${client.brand_voice}\n`
  if (client.competitors) ctx += `- Competitors: ${client.competitors}\n`
  if (client.kpi_goals) ctx += `- KPI goals: ${client.kpi_goals}\n`
  if (client.ai_notes) ctx += `- Notes: ${client.ai_notes}\n`
  ctx += '\n'

  // Account config
  ctx += `## Account Config\n`
  ctx += `- Account: ${account.name} (act_${account.platform_account_id})\n`
  ctx += `- Objective: ${account.objective || 'N/A'} | Action type: ${account.primary_action_type || 'lead'}\n`
  ctx += `- Target CPL: $${account.target_cpl || 'not set'}`
  if (account.target_roas) ctx += ` | Target ROAS: ${account.target_roas}x`
  ctx += '\n\n'

  // Current period performance
  ctx += `## Current Period Performance (${days}d)\n`
  ctx += `- Spend: $${tw.spend.toFixed(2)} | Results: ${tw.results} | CPR: $${cpr.toFixed(2)}\n`
  ctx += `- Impressions: ${tw.impressions.toLocaleString()} | Clicks: ${tw.clicks.toLocaleString()}\n`
  ctx += `- CTR: ${ctr.toFixed(2)}% | CPC: $${cpc.toFixed(2)} | Conv Rate: ${convRate.toFixed(2)}%\n`
  if (isEcom) ctx += `- Revenue: $${tw.revenue.toFixed(2)} | ROAS: ${roas.toFixed(2)}x\n`
  if (tw.lpv > 0) ctx += `- Landing page views: ${tw.lpv} | LP→Conv: ${tw.results > 0 && tw.lpv > 0 ? (tw.results / tw.lpv * 100).toFixed(1) : 0}%\n`
  ctx += '\n'

  // Previous period comparison
  ctx += `## Previous Period Comparison (${days}d)\n`
  const lwCtr = lw.impressions > 0 ? (lw.clicks / lw.impressions * 100) : 0
  ctx += `- Spend: $${lw.spend.toFixed(2)} | Results: ${lw.results} | CPR: $${lwCpr.toFixed(2)}\n`
  ctx += `- Spend change: ${lw.spend > 0 ? ((tw.spend - lw.spend) / lw.spend * 100).toFixed(1) + '%' : 'N/A'}\n`
  ctx += `- Result change: ${lw.results > 0 ? ((tw.results - lw.results) / lw.results * 100).toFixed(1) + '%' : 'N/A'}\n`
  ctx += `- CPR change: ${lwCpr > 0 && cpr > 0 ? ((cpr - lwCpr) / lwCpr * 100).toFixed(1) + '%' : 'N/A'}\n`
  if (isEcom && lw.revenue > 0) ctx += `- Revenue change: ${((tw.revenue - lw.revenue) / lw.revenue * 100).toFixed(1)}%\n`
  ctx += '\n'

  // Daily breakdown
  ctx += `## Daily Breakdown\n`
  for (const day of thisWeek) {
    const dr = (day.leads || 0) + (day.purchases || 0) + (day.schedules || 0)
    const dcpr = dr > 0 ? (day.spend || 0) / dr : 0
    const dctr = (day.impressions || 0) > 0 ? ((day.clicks || 0) / (day.impressions || 1) * 100) : 0
    ctx += `- ${day.date}: $${(day.spend || 0).toFixed(0)} spend, ${dr} results, $${dcpr.toFixed(2)} CPR, ${dctr.toFixed(1)}% CTR, ${(day.impressions || 0).toLocaleString()} imp\n`
  }
  ctx += '\n'

  // Campaign breakdown
  const sortedCampaigns = Object.entries(campaigns).sort((a, b) => b[1].spend - a[1].spend)
  if (sortedCampaigns.length > 0) {
    ctx += `## Campaign Breakdown (${sortedCampaigns.length} campaigns)\n`
    for (const [name, d] of sortedCampaigns.slice(0, 15)) {
      const ccpr = d.results > 0 ? d.spend / d.results : 0
      const cctr = d.impressions > 0 ? (d.clicks / d.impressions * 100) : 0
      ctx += `- ${name}: $${d.spend.toFixed(0)} spend, ${d.results} results, $${ccpr.toFixed(2)} CPR, ${cctr.toFixed(2)}% CTR`
      if (isEcom && d.revenue) ctx += `, $${d.revenue.toFixed(0)} rev`
      ctx += '\n'
    }
    ctx += '\n'
  }

  // Ad set breakdown
  const sortedAdSets = Object.entries(adSets).sort((a, b) => b[1].spend - a[1].spend)
  if (sortedAdSets.length > 0) {
    ctx += `## Ad Set Breakdown (top ${Math.min(sortedAdSets.length, 15)})\n`
    for (const [name, d] of sortedAdSets.slice(0, 15)) {
      const acpr = d.results > 0 ? d.spend / d.results : 0
      const actr = d.impressions > 0 ? (d.clicks / d.impressions * 100) : 0
      ctx += `- ${name} [${d.campaign}]: $${d.spend.toFixed(0)} spend, ${d.results} results, $${acpr.toFixed(2)} CPR, ${actr.toFixed(2)}% CTR\n`
    }
    ctx += '\n'
  }

  // Top performers with creative details
  if (topPerformers.length > 0) {
    ctx += `## Top Performing Ads (by CPR)\n`
    for (const [name, d] of topPerformers) {
      const acpr = d.spend / d.results
      const creative = creativeMap.get(name)
      ctx += `- "${name}"\n`
      ctx += `  Campaign: ${d.campaign} | Ad Set: ${d.adSet || 'N/A'}\n`
      ctx += `  Spend: $${d.spend.toFixed(2)} | Results: ${d.results} | CPR: $${acpr.toFixed(2)}\n`
      ctx += `  Clicks: ${d.clicks} | Impressions: ${d.impressions.toLocaleString()}\n`
      if (creative) {
        if (creative.creative_headline) ctx += `  Headline: "${creative.creative_headline}"\n`
        if (creative.creative_body) ctx += `  Body: "${creative.creative_body.slice(0, 200)}"\n`
        if (creative.creative_cta) ctx += `  CTA: ${creative.creative_cta}\n`
      }
    }
    ctx += '\n'
  }

  // Underperformers
  if (nonConverting.length > 0) {
    const wastedSpend = nonConverting.reduce((s, [, d]) => s + d.spend, 0)
    ctx += `## Non-Converting Ads (0 results, $${wastedSpend.toFixed(0)} wasted)\n`
    for (const [name, d] of nonConverting.slice(0, 8)) {
      ctx += `- "${name}": $${d.spend.toFixed(0)} spent, ${d.clicks} clicks, ${d.impressions.toLocaleString()} imp [${d.campaign}]\n`
    }
    ctx += '\n'
  }

  if (highCost.length > 0) {
    ctx += `## High-Cost Ads (converting but expensive)\n`
    for (const [name, d] of highCost) {
      const acpr = d.spend / d.results
      ctx += `- "${name}": $${acpr.toFixed(2)} CPR (${d.results} results, $${d.spend.toFixed(0)} spent) [${d.campaign}]\n`
    }
    ctx += '\n'
  }

  // All ads summary with creative info
  const activeAds = (activeAdsRes.data || [])
  const activeCount = activeAds.filter(a => a.effective_status === 'ACTIVE').length
  const pausedCount = activeAds.filter(a => a.effective_status === 'PAUSED').length
  ctx += `## Ad Inventory: ${activeCount} active, ${pausedCount} paused\n`

  // Headline frequency analysis
  const headlines: Record<string, number> = {}
  for (const ad of activeAds.filter(a => a.effective_status === 'ACTIVE')) {
    const h = ad.creative_headline || 'No headline'
    headlines[h] = (headlines[h] || 0) + 1
  }
  const sortedHeadlines = Object.entries(headlines).sort((a, b) => b[1] - a[1])
  if (sortedHeadlines.length > 0) {
    ctx += `\n## Headline Distribution (active ads)\n`
    for (const [h, count] of sortedHeadlines.slice(0, 10)) {
      ctx += `- "${h}" — used ${count}x\n`
    }
  }

  // CTA distribution
  const ctas: Record<string, number> = {}
  for (const ad of activeAds.filter(a => a.effective_status === 'ACTIVE')) {
    const c = ad.creative_cta || 'No CTA'
    ctas[c] = (ctas[c] || 0) + 1
  }
  if (Object.keys(ctas).length > 1) {
    ctx += `\n## CTA Distribution\n`
    for (const [c, count] of Object.entries(ctas).sort((a, b) => b[1] - a[1])) {
      ctx += `- ${c}: ${count} ads\n`
    }
  }

  // === AUDIENCE BREAKDOWN ===
  const ageGenderData = ageGenderRes.data || []
  if (ageGenderData.length > 0) {
    // Aggregate by age group
    const ages: Record<string, { spend: number; results: number; clicks: number; impressions: number }> = {}
    const genders: Record<string, { spend: number; results: number; clicks: number; impressions: number }> = {}

    for (const row of ageGenderData) {
      const age = row.dimension_1 || 'Unknown'
      const gender = row.dimension_2 || 'Unknown'
      const results = (row.leads || 0) + (row.purchases || 0)

      if (!ages[age]) ages[age] = { spend: 0, results: 0, clicks: 0, impressions: 0 }
      ages[age].spend += row.spend || 0
      ages[age].results += results
      ages[age].clicks += row.clicks || 0
      ages[age].impressions += row.impressions || 0

      if (!genders[gender]) genders[gender] = { spend: 0, results: 0, clicks: 0, impressions: 0 }
      genders[gender].spend += row.spend || 0
      genders[gender].results += results
      genders[gender].clicks += row.clicks || 0
      genders[gender].impressions += row.impressions || 0
    }

    ctx += `\n## Audience: Age Breakdown\n`
    for (const [age, d] of Object.entries(ages).sort((a, b) => b[1].spend - a[1].spend)) {
      const acpr = d.results > 0 ? d.spend / d.results : 0
      const actr = d.impressions > 0 ? (d.clicks / d.impressions * 100) : 0
      ctx += `- ${age}: $${d.spend.toFixed(0)} spend, ${d.results} results, $${acpr.toFixed(2)} CPR, ${actr.toFixed(2)}% CTR\n`
    }

    ctx += `\n## Audience: Gender Breakdown\n`
    for (const [gender, d] of Object.entries(genders).sort((a, b) => b[1].spend - a[1].spend)) {
      const gcpr = d.results > 0 ? d.spend / d.results : 0
      ctx += `- ${gender}: $${d.spend.toFixed(0)} spend, ${d.results} results, $${gcpr.toFixed(2)} CPR\n`
    }
    ctx += '\n'
  }

  // === PLACEMENT BREAKDOWN ===
  const placementData = placementRes.data || []
  if (placementData.length > 0) {
    const placements: Record<string, { spend: number; results: number; clicks: number; impressions: number }> = {}

    for (const row of placementData) {
      const platform = row.dimension_1 || 'Unknown'
      const position = row.dimension_2 || 'Unknown'
      const key = `${platform} — ${position}`
      const results = (row.leads || 0) + (row.purchases || 0)

      if (!placements[key]) placements[key] = { spend: 0, results: 0, clicks: 0, impressions: 0 }
      placements[key].spend += row.spend || 0
      placements[key].results += results
      placements[key].clicks += row.clicks || 0
      placements[key].impressions += row.impressions || 0
    }

    ctx += `## Placement Breakdown\n`
    for (const [name, d] of Object.entries(placements).sort((a, b) => b[1].spend - a[1].spend).slice(0, 12)) {
      const pcpr = d.results > 0 ? d.spend / d.results : 0
      const pctr = d.impressions > 0 ? (d.clicks / d.impressions * 100) : 0
      ctx += `- ${name}: $${d.spend.toFixed(0)} spend, ${d.results} results, $${pcpr.toFixed(2)} CPR, ${pctr.toFixed(2)}% CTR\n`
    }
    ctx += '\n'
  }

  // === UNIFIED AD PERFORMANCE + CREATIVE VIEW ===
  // Merge ad performance with creative details so Gemini can analyze which creative elements drive results
  if (sortedAds.length > 0) {
    ctx += `## Ad Performance with Creative Details (top ${Math.min(sortedAds.length, 20)} by spend)\n`
    for (const [name, d] of sortedAds.slice(0, 20)) {
      const acpr = d.results > 0 ? d.spend / d.results : 0
      const actr = d.impressions > 0 ? (d.clicks / d.impressions * 100) : 0
      const creative = creativeMap.get(name)
      ctx += `\n### "${name}"\n`
      ctx += `- Performance: $${d.spend.toFixed(2)} spend | ${d.results} results | $${acpr.toFixed(2)} CPR | ${actr.toFixed(2)}% CTR | ${d.clicks} clicks\n`
      ctx += `- Campaign: ${d.campaign} | Ad Set: ${d.adSet || 'N/A'}\n`
      if (creative) {
        ctx += `- Status: ${creative.effective_status}\n`
        if (creative.creative_headline) ctx += `- Headline: "${creative.creative_headline}"\n`
        if (creative.creative_body) ctx += `- Body: "${creative.creative_body.slice(0, 300)}"\n`
        if (creative.creative_cta) ctx += `- CTA: ${creative.creative_cta}\n`
      }
    }
    ctx += '\n'
  }

  // === PRE-ANALYSIS ENGINE ===
  const dayData = thisWeek.map(d => ({
    date: d.date,
    spend: d.spend || 0,
    impressions: d.impressions || 0,
    clicks: d.clicks || 0,
    results: (d.leads || 0) + (d.purchases || 0) + (d.schedules || 0),
    revenue: d.purchase_value || 0,
    lpv: d.landing_page_views || 0,
  }))
  const lwDayData = lastWeek.map(d => ({
    date: d.date,
    spend: d.spend || 0,
    impressions: d.impressions || 0,
    clicks: d.clicks || 0,
    results: (d.leads || 0) + (d.purchases || 0) + (d.schedules || 0),
    revenue: d.purchase_value || 0,
    lpv: d.landing_page_views || 0,
  }))
  const adDataForAnalysis = sortedAds.map(([name, d]) => ({
    name, campaign: d.campaign, adSet: d.adSet || '', spend: d.spend, results: d.results, clicks: d.clicks, impressions: d.impressions, revenue: d.revenue,
  }))
  const campDataForAnalysis = Object.entries(campaigns).map(([name, d]) => ({
    name, spend: d.spend, results: d.results, clicks: d.clicks, impressions: d.impressions, revenue: d.revenue,
  }))

  const analysis = preAnalyze(dayData, lwDayData, adDataForAnalysis, campDataForAnalysis, account.target_cpl, isEcom, account.target_roas)

  ctx += `\n## ===== AUTOMATED SIGNALS (pre-computed) =====\n`
  ctx += `Trend: ${analysis.trendDirection}\n`
  ctx += `Spend health: ${analysis.spendHealth}\n\n`

  if (analysis.signals.length > 0) {
    ctx += `### Key Signals\n`
    for (const s of analysis.signals) ctx += `- ${s}\n`
    ctx += '\n'
  }

  if (analysis.fatigueSignals.length > 0) {
    ctx += `### Fatigue Signals\n`
    for (const s of analysis.fatigueSignals) ctx += `- ${s}\n`
    ctx += '\n'
  }

  if (analysis.anomalies.length > 0) {
    ctx += `### Anomalies\n`
    for (const s of analysis.anomalies) ctx += `- ${s}\n`
    ctx += '\n'
  }

  if (analysis.wastedSpend.total > 0) {
    ctx += `### Wasted Spend: $${analysis.wastedSpend.total.toFixed(0)}\n`
    for (const d of analysis.wastedSpend.details) ctx += `- ${d}\n`
    ctx += '\n'
  }

  if (analysis.scalingOpportunities.length > 0) {
    ctx += `### Scaling Opportunities\n`
    for (const s of analysis.scalingOpportunities) ctx += `- ${s}\n`
    ctx += '\n'
  }

  if (analysis.concentrationRisk) {
    ctx += `### Concentration Risk\n- ${analysis.concentrationRisk}\n\n`
  }

  // Audience targeting signals
  if (ageGenderData.length > 0) {
    const ageAgg: Record<string, { spend: number; results: number }> = {}
    for (const row of ageGenderData) {
      const age = row.dimension_1 || 'Unknown'
      if (!ageAgg[age]) ageAgg[age] = { spend: 0, results: 0 }
      ageAgg[age].spend += row.spend || 0
      ageAgg[age].results += (row.leads || 0) + (row.purchases || 0)
    }
    const audienceSignals = analyzeAudience(ageAgg, account.target_cpl)
    if (audienceSignals.length > 0) {
      ctx += `### Audience Targeting Signals\n`
      for (const s of audienceSignals) ctx += `- ${s}\n`
      ctx += '\n'
    }
  }

  // Placement efficiency signals
  if (placementData.length > 0) {
    const placementAgg: Record<string, { spend: number; results: number }> = {}
    for (const row of placementData) {
      const key = `${row.dimension_1 || 'Unknown'} — ${row.dimension_2 || 'Unknown'}`
      if (!placementAgg[key]) placementAgg[key] = { spend: 0, results: 0 }
      placementAgg[key].spend += row.spend || 0
      placementAgg[key].results += (row.leads || 0) + (row.purchases || 0)
    }
    const totalSpend = Object.values(placementAgg).reduce((s, d) => s + d.spend, 0)
    const placementSignals: string[] = []
    const targetCPR = account.target_cpl || 0
    const corePlacements = ['feed', 'stories', 'reels']
    const isCore = (name: string) => corePlacements.some(p => name.toLowerCase().includes(p))

    for (const [name, d] of Object.entries(placementAgg).sort((a, b) => b[1].spend - a[1].spend)) {
      if (d.spend < 10) continue
      const cpr = d.results > 0 ? d.spend / d.results : Infinity
      const pct = totalSpend > 0 ? (d.spend / totalSpend * 100) : 0
      const core = isCore(name)

      if (d.results === 0 && d.spend > 50) {
        if (core) {
          placementSignals.push(`INVESTIGATE: "${name}" (CORE placement) spent $${d.spend.toFixed(0)} with zero results this period — likely a creative/targeting issue, NOT a placement issue. Diagnose why.`)
        } else {
          placementSignals.push(`CUT CANDIDATE: "${name}" (minor placement) spent $${d.spend.toFixed(0)} with zero results (${pct.toFixed(1)}% of spend)`)
        }
      } else if (targetCPR > 0 && cpr > targetCPR * 2) {
        if (core) {
          placementSignals.push(`UNDERPERFORMING: "${name}" (CORE) CPR $${cpr.toFixed(2)} is ${(cpr/targetCPR).toFixed(1)}x target — investigate creative fit for this placement`)
        } else {
          placementSignals.push(`EXPENSIVE: "${name}" CPR $${cpr.toFixed(2)} is ${(cpr/targetCPR).toFixed(1)}x target ($${targetCPR}) — spent $${d.spend.toFixed(0)}`)
        }
      } else if (targetCPR > 0 && cpr <= targetCPR * 0.8 && d.results >= 3) {
        placementSignals.push(`STRONG: "${name}" CPR $${cpr.toFixed(2)} is ${((1 - cpr/targetCPR) * 100).toFixed(0)}% below target — ${d.results} results from $${d.spend.toFixed(0)}`)
      }
    }
    if (placementSignals.length > 0) {
      ctx += `### Placement Efficiency Signals\n`
      for (const s of placementSignals) ctx += `- ${s}\n`
      ctx += `NOTE: Core placements (Feed, Stories, Reels) should NEVER be cut. Poor performance on a core placement = creative/targeting problem. Only minor placements (Audience Network, Marketplace, Messenger, etc.) are candidates for removal.\n\n`
    }
  }

  return { client, context: ctx }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

    const apiKey = await getOrgGeminiKey()
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No Gemini API key configured. Add one in Settings > Agency.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      })
    }

    const { messages, clientId, days } = await req.json()
    if (!messages?.length) return new Response(JSON.stringify({ error: 'No messages' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    if (!clientId) return new Response(JSON.stringify({ error: 'No client selected' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

    const lookbackDays = Math.min(Math.max(days || 7, 7), 90)
    const result = await getClientContext(clientId, lookbackDays)
    if (!result) return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })

    const member = await getUserOrgRole(user.id)

    const systemPrompt = `You are Pegasus — a senior Meta ads media buyer with 10 years of experience managing 8-figure ad budgets. You think in terms of unit economics, creative fatigue cycles, audience saturation, and marginal ROAS. You are analyzing a client account with ${lookbackDays} days of data.

## How You Think

You don't just report numbers — you diagnose WHY things are happening and prescribe WHAT TO DO about it. Every observation leads to an action.

When CPR goes up, you ask: Is it creative fatigue (frequency rising)? Audience saturation (CPM rising)? Landing page issue (CTR fine but conv rate dropping)? Tracking broken (sudden zero-result days)?

When something works, you ask: Can we scale it? What's the ceiling? What would break if we doubled budget? Are we over-indexed on one winner?

## Rules

1. ALWAYS cite exact ad names, campaign names, and numbers. The user needs to find things in Ads Manager.
2. Lead with the most important thing — what needs action TODAY, not background.
3. When you see the "AUTOMATED SIGNALS" section, those are pre-computed insights. Use them as the foundation of your analysis, add depth and reasoning, and suggest specific actions.
4. Distinguish between "do this now" (pause a bleeding ad), "do this this week" (launch a creative test), and "watch this" (a trend that might become a problem).
5. When recommending creative changes, be specific about angles — not "test new creative" but "test a social proof angle with before/after imagery based on what's working in the top performer."
6. Think about the client's BUSINESS, not just their ads. If they're a kitchen remodeler, a $40 CPL might be amazing ($15K average job). If they're selling a $20 product, it's a disaster.
7. No emojis. No corporate fluff. No "Great question!" — just answer.
8. Format for readability: use headers, bullets, bold the numbers that matter.
9. NEVER recommend removing core placements (Facebook Feed, Instagram Feed, Instagram Stories, Instagram Reels, Facebook Reels). These are where the vast majority of Meta's inventory lives. If a core placement is underperforming, the problem is CREATIVE or TARGETING, not the placement itself. Diagnose WHY it's underperforming (wrong format? weak hook? audience mismatch?) and recommend fixes.
10. Only recommend cutting MINOR placements (Audience Network, Messenger, Facebook Marketplace, Search, Right Column, Explore Home) when they have meaningful spend with zero or terrible results AND the account has enough data to confirm the pattern.
11. "Facebook Feed" and "Instagram Feed" are COMPLETELY different placements with different audiences, CPRs, and creative requirements. Never lump them together. Evaluate each individually.
12. When a placement underperforms short-term but is a core placement, say "this is underperforming RIGHT NOW — here's what to investigate" not "turn it off." One bad week on Feed is a creative signal, not a placement signal.

## Your Data

Below is the full account data with automated pre-analysis signals at the bottom. The signals section contains patterns I've already identified — build your analysis on top of these.

The user is ${member?.display_name || user.email} (${member?.role || 'member'}).

${result.context}`

    // Gemini 2.5 Pro with streaming
    const geminiMessages = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('Gemini error:', err)
      return new Response(JSON.stringify({ error: 'AI service error. Check your Gemini API key.' }), {
        status: 502, headers: { 'Content-Type': 'application/json' }
      })
    }

    // Stream SSE back
    const readable = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        if (!reader) { controller.close(); return }
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            for (const line of chunk.split('\n')) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (!data) continue
                try {
                  const parsed = JSON.parse(data)
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
                  if (text) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`))
                } catch {}
              }
            }
          }
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        } catch (e) { console.error('Stream error:', e) }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    })
  } catch (e: any) {
    console.error('Pegasus chat error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
