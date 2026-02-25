import { NextRequest } from 'next/server'
import { getUser, getUserOrgRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isEcomActionType } from '@/lib/utils'
import { preAnalyze, analyzeAudience } from '@/lib/analysis'

const ORG_ID = process.env.ADSINC_ORG_ID!
const META_TOKEN = process.env.META_ACCESS_TOKEN!
const META_VERSION = process.env.META_API_VERSION || 'v21.0'

// ── Video/Image helpers for multimodal Pegasus ──

async function getVideoSourceUrl(adPlatformId: string): Promise<string | null> {
  try {
    const adRes = await fetch(
      `https://graph.facebook.com/${META_VERSION}/${adPlatformId}?fields=creative{object_story_spec,asset_feed_spec}&access_token=${META_TOKEN}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!adRes.ok) return null
    const adData = await adRes.json()
    let videoId: string | null = null
    const creative = adData.creative
    if (creative?.object_story_spec?.video_data?.video_id) videoId = creative.object_story_spec.video_data.video_id
    else if (creative?.asset_feed_spec?.videos?.[0]?.video_id) videoId = creative.asset_feed_spec.videos[0].video_id
    if (!videoId) return null
    const vidRes = await fetch(
      `https://graph.facebook.com/${META_VERSION}/${videoId}?fields=source&access_token=${META_TOKEN}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!vidRes.ok) return null
    const vidData = await vidRes.json()
    return vidData.source || null
  } catch { return null }
}

async function uploadVideoToGemini(videoBuffer: ArrayBuffer, filename: string, apiKey: string): Promise<string | null> {
  try {
    const initRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(videoBuffer.byteLength),
          'X-Goog-Upload-Header-Content-Type': 'video/mp4',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: filename } }),
      }
    )
    const uploadUrl = initRes.headers.get('x-goog-upload-url')
    if (!uploadUrl) return null
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize', 'Content-Length': String(videoBuffer.byteLength) },
      body: videoBuffer,
    })
    if (!uploadRes.ok) return null
    const result = await uploadRes.json()
    const fileName = result.file?.name
    if (!fileName) return null
    // Poll until active
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const statusRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`)
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        if (statusData.state === 'ACTIVE') return result.file.uri
        if (statusData.state === 'FAILED') return null
      }
    }
    return null
  } catch { return null }
}

async function deleteGeminiFile(fileUri: string, apiKey: string) {
  try {
    const fileName = fileUri.split('/').slice(-2).join('/')
    await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`, { method: 'DELETE' })
  } catch {}
}

async function fetchImageBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    return { data: Buffer.from(buffer).toString('base64'), mimeType: res.headers.get('content-type') || 'image/jpeg' }
  } catch { return null }
}

// Detect if user message is asking for visual/video analysis of specific ads
function detectMediaIntent(message: string): { needsMedia: boolean; keywords: string[] } {
  const lower = message.toLowerCase()
  const mediaTerms = ['transcript', 'transcribe', 'watch', 'look at', 'show me', 'what does', 'what do', 'see the', 'see this',
    'analyze the video', 'analyze the image', 'analyze the creative', 'analyze the ad',
    'video analysis', 'creative analysis', 'what\'s in the', 'describe the', 'review the creative',
    'what is the ad', 'the ad look like', 'hook', 'first 3 seconds', 'visual', 'thumbnail',
    'what are they saying', 'what does it say', 'audio', 'scene', 'creative review']
  const needs = mediaTerms.some(t => lower.includes(t))
  // Extract potential ad name references
  const keywords = lower.split(/[\s,]+/).filter(w => w.length > 3)
  return { needsMedia: needs, keywords }
}

// Find ads that match the user's query from the active ads list
function findReferencedAds(message: string, activeAds: any[]): any[] {
  if (!activeAds?.length) return []
  const lower = message.toLowerCase()

  // Try exact name matches first
  const matches = activeAds.filter(ad => {
    const adName = (ad.name || '').toLowerCase()
    return adName && lower.includes(adName)
  })
  if (matches.length > 0) return matches.slice(0, 3)

  // Try partial matches — look for significant words from ad names
  const scored = activeAds.map(ad => {
    const adWords = (ad.name || '').toLowerCase().split(/[\s_-]+/).filter((w: string) => w.length > 3)
    const matchCount = adWords.filter((w: string) => lower.includes(w)).length
    return { ad, score: matchCount }
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score)

  if (scored.length > 0) return scored.slice(0, 3).map(s => s.ad)

  // If they say "top performing" or "best" — pick by CPR from context
  if (lower.includes('top') || lower.includes('best') || lower.includes('winner') || lower.includes('#1') || lower.includes('number one')) {
    return activeAds.filter(a => a.creative_url || a.creative_video_url).slice(0, 3)
  }

  return []
}

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
  const [insightsRes, campaignRes, adInsightsRes, adSetInsightsRes, activeAdsRes, ageGenderRes, placementRes, campaignReachRes, adSetBudgetRes, campaignBudgetRes] = await Promise.all([
    // Account-level daily insights (current + previous period)
    // Try account level first; will fall back to campaign if empty
    supabaseAdmin
      .from('insights')
      .select('date, level, spend, impressions, clicks, reach, leads, purchases, purchase_value, schedules, landing_page_views')
      .eq('ad_account_id', account.id)
      .in('level', ['account', 'campaign'])
      .gte('date', pStart)
      .lte('date', yStr)
      .order('date')
      .limit(2000),

    // Campaign-level insights (current period)
    supabaseAdmin
      .from('insights')
      .select('platform_campaign_id, spend, impressions, clicks, leads, purchases, purchase_value, schedules, landing_page_views')
      .eq('ad_account_id', account.id)
      .eq('level', 'campaign')
      .gte('date', dStr)
      .lte('date', yStr)
      .limit(2000),

    // Ad-level insights (current period) — for performance ranking
    supabaseAdmin
      .from('insights')
      .select('platform_ad_id, platform_campaign_id, platform_ad_set_id, spend, impressions, clicks, leads, purchases, schedules, purchase_value')
      .eq('ad_account_id', account.id)
      .eq('level', 'ad')
      .gte('date', dStr)
      .lte('date', yStr)
      .limit(5000),

    // Ad set level insights (current period)
    supabaseAdmin
      .from('insights')
      .select('platform_ad_set_id, platform_campaign_id, spend, impressions, clicks, leads, purchases, schedules, purchase_value')
      .eq('ad_account_id', account.id)
      .eq('level', 'adset')
      .gte('date', dStr)
      .lte('date', yStr)
      .limit(2000),

    // Active ads with creative info + creation date
    supabaseAdmin
      .from('ads')
      .select('platform_ad_id, ad_set_id, name, creative_headline, creative_body, creative_cta, creative_url, creative_video_url, creative_thumbnail_url, effective_status, created_time')
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

    // Campaign-level reach for frequency calculation
    supabaseAdmin
      .from('insights')
      .select('platform_campaign_id, spend, impressions, reach, clicks, leads, purchases, schedules, landing_page_views')
      .eq('ad_account_id', account.id)
      .eq('level', 'campaign')
      .gte('date', dStr)
      .lte('date', yStr)
      .limit(2000),

    // Ad set budgets
    supabaseAdmin
      .from('ad_sets')
      .select('name, daily_budget, optimization_goal, status, campaign_id')
      .eq('ad_account_id', account.id)
      .in('status', ['ACTIVE', 'PAUSED']),

    // Campaign budgets
    supabaseAdmin
      .from('campaigns')
      .select('name, daily_budget, lifetime_budget, status, platform_campaign_id')
      .eq('ad_account_id', account.id)
      .in('status', ['ACTIVE', 'PAUSED']),
  ])

  // Build name maps from entity tables
  const { data: campaignEntities } = await supabaseAdmin
    .from('campaigns')
    .select('platform_campaign_id, name')
    .eq('ad_account_id', account.id)
  const { data: adSetEntities } = await supabaseAdmin
    .from('ad_sets')
    .select('platform_ad_set_id, name, campaign_id')
    .eq('ad_account_id', account.id)
  const { data: adEntities } = await supabaseAdmin
    .from('ads')
    .select('platform_ad_id, name, ad_set_id')
    .eq('ad_account_id', account.id)

  const campNameMap = new Map<string, string>()
  for (const c of (campaignEntities || [])) campNameMap.set(c.platform_campaign_id, c.name)
  const adSetNameMap = new Map<string, string>()
  const adSetToCampMap = new Map<string, string>()
  for (const as of (adSetEntities || [])) {
    adSetNameMap.set(as.platform_ad_set_id, as.name)
    if (as.campaign_id) adSetToCampMap.set(as.platform_ad_set_id, as.campaign_id)
  }
  const adNameMap = new Map<string, string>()
  for (const a of (adEntities || [])) adNameMap.set(a.platform_ad_id, a.name)

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
    reach: s.reach + (i.reach || 0),
  }), { spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0, lpv: 0, reach: 0 })

  const tw = agg(thisWeek)
  const lw = agg(lastWeek)

  // Aggregate campaign data
  const campaigns: Record<string, any> = {}
  for (const ci of (campaignRes.data || [])) {
    const name = campNameMap.get(ci.platform_campaign_id) || ci.platform_campaign_id || 'Unknown'
    if (!campaigns[name]) campaigns[name] = { spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0, lpv: 0 }
    campaigns[name].spend += ci.spend || 0
    campaigns[name].results += (ci.leads || 0) + (ci.purchases || 0) + (ci.schedules || 0)
    campaigns[name].clicks += ci.clicks || 0
    campaigns[name].impressions += ci.impressions || 0
    campaigns[name].revenue += ci.purchase_value || 0
    campaigns[name].lpv += ci.landing_page_views || 0
  }

  // Aggregate ad set data
  const adSets: Record<string, any> = {}
  for (const as of (adSetInsightsRes.data || [])) {
    const name = adSetNameMap.get(as.platform_ad_set_id) || as.platform_ad_set_id || 'Unknown'
    const campName = campNameMap.get(as.platform_campaign_id) || as.platform_campaign_id || 'Unknown'
    if (!adSets[name]) adSets[name] = { campaign: campName, spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
    adSets[name].spend += as.spend || 0
    adSets[name].results += (as.leads || 0) + (as.purchases || 0) + (as.schedules || 0)
    adSets[name].clicks += as.clicks || 0
    adSets[name].impressions += as.impressions || 0
    adSets[name].revenue += as.purchase_value || 0
  }

  // Aggregate ad-level data
  const ads: Record<string, any> = {}
  for (const ai of (adInsightsRes.data || [])) {
    const name = adNameMap.get(ai.platform_ad_id) || ai.platform_ad_id || 'Unknown'
    const campName = campNameMap.get(ai.platform_campaign_id) || ai.platform_campaign_id || 'Unknown'
    const adSetName = adSetNameMap.get(ai.platform_ad_set_id) || ai.platform_ad_set_id || ''
    if (!ads[name]) ads[name] = { campaign: campName, adSet: adSetName, spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
    ads[name].spend += ai.spend || 0
    ads[name].results += (ai.leads || 0) + (ai.purchases || 0) + (ai.schedules || 0)
    ads[name].clicks += ai.clicks || 0
    ads[name].impressions += ai.impressions || 0
    ads[name].revenue += ai.purchase_value || 0
  }

  // Creative lookup map from active ads (by name for matching with insights-derived ad names)
  const creativeMap = new Map<string, any>()
  for (const ad of (activeAdsRes.data || [])) {
    creativeMap.set(ad.name, ad)
  }
  // Also map by platform_ad_id for the active ads list
  const creativeByPlatformId = new Map<string, any>()
  for (const ad of (activeAdsRes.data || [])) {
    creativeByPlatformId.set(ad.platform_ad_id, ad)
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
  const lwCtr = lw.impressions > 0 ? (lw.clicks / lw.impressions * 100) : 0
  const cpc = tw.clicks > 0 ? tw.spend / tw.clicks : 0
  const convRate = tw.clicks > 0 ? (tw.results / tw.clicks * 100) : 0
  const roas = tw.spend > 0 ? tw.revenue / tw.spend : 0
  // Account-level frequency from reach data
  const totalReach = thisWeek.reduce((s, d) => s + (d.reach || 0), 0)
  const accountFrequency = totalReach > 0 ? tw.impressions / totalReach : 0

  // Campaign-level frequency + reach
  const campaignReach: Record<string, { impressions: number; reach: number; spend: number; results: number; clicks: number; lpv: number }> = {}
  for (const row of (campaignReachRes.data || [])) {
    const name = campNameMap.get(row.platform_campaign_id) || row.platform_campaign_id || 'Unknown'
    if (!campaignReach[name]) campaignReach[name] = { impressions: 0, reach: 0, spend: 0, results: 0, clicks: 0, lpv: 0 }
    campaignReach[name].impressions += row.impressions || 0
    campaignReach[name].reach += row.reach || 0
    campaignReach[name].spend += row.spend || 0
    campaignReach[name].results += (row.leads || 0) + (row.purchases || 0) + (row.schedules || 0)
    campaignReach[name].clicks += row.clicks || 0
    campaignReach[name].lpv += row.landing_page_views || 0
  }

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
  if (accountFrequency > 0) ctx += `- Frequency: ${accountFrequency.toFixed(2)} | Reach: ${totalReach.toLocaleString()}\n`
  ctx += '\n'

  // === FUNNEL DIAGNOSIS ===
  const cpm = tw.impressions > 0 ? (tw.spend / tw.impressions * 1000) : 0
  const clickToLPV = tw.lpv > 0 && tw.clicks > 0 ? (tw.lpv / tw.clicks * 100) : 0
  const lpvToConv = tw.lpv > 0 && tw.results > 0 ? (tw.results / tw.lpv * 100) : 0
  const lwCpm = lw.impressions > 0 ? (lw.spend / lw.impressions * 1000) : 0
  const lwConvRate = lw.clicks > 0 ? (lw.results / lw.clicks * 100) : 0
  const lwLpvToConv = lw.lpv > 0 && lw.results > 0 ? (lw.results / lw.lpv * 100) : 0
  const lwFreq = lw.reach > 0 ? lw.impressions / lw.reach : 0

  ctx += `## Funnel Analysis\n`
  ctx += `- CPM: $${cpm.toFixed(2)}${lwCpm > 0 ? ` (prev: $${lwCpm.toFixed(2)}, ${((cpm - lwCpm) / lwCpm * 100).toFixed(1)}% change)` : ''}\n`
  ctx += `- CTR: ${ctr.toFixed(2)}%${lwCtr > 0 ? ` (prev: ${lwCtr.toFixed(2)}%)` : ''}\n`
  ctx += `- CPC: $${cpc.toFixed(2)}\n`
  if (tw.lpv > 0) {
    ctx += `- Click → Landing Page: ${clickToLPV.toFixed(1)}% (${tw.lpv} LPVs from ${tw.clicks} clicks)\n`
    ctx += `- Landing Page → Conversion: ${lpvToConv.toFixed(2)}%${lwLpvToConv > 0 ? ` (prev: ${lwLpvToConv.toFixed(2)}%)` : ''}\n`
  }
  ctx += `- Click → Conversion: ${convRate.toFixed(2)}%${lwConvRate > 0 ? ` (prev: ${lwConvRate.toFixed(2)}%)` : ''}\n`
  if (accountFrequency > 0) ctx += `- Frequency: ${accountFrequency.toFixed(2)}${lwFreq > 0 ? ` (prev: ${lwFreq.toFixed(2)})` : ''}\n`

  // Funnel diagnosis signals
  const funnelSignals: string[] = []
  if (cpm > 0 && lwCpm > 0 && (cpm - lwCpm) / lwCpm > 0.2) funnelSignals.push(`CPM up ${((cpm - lwCpm) / lwCpm * 100).toFixed(0)}% — audience saturation or increased competition. Check frequency.`)
  if (ctr > 0 && lwCtr > 0 && (lwCtr - ctr) / lwCtr > 0.2) funnelSignals.push(`CTR down ${((lwCtr - ctr) / lwCtr * 100).toFixed(0)}% — creative fatigue or audience mismatch. Review top-of-funnel creative.`)
  if (clickToLPV > 0 && clickToLPV < 60) funnelSignals.push(`Only ${clickToLPV.toFixed(0)}% of clicks reach the landing page — slow load, broken tracking, or accidental clicks.`)
  if (lpvToConv > 0 && lwLpvToConv > 0 && (lwLpvToConv - lpvToConv) / lwLpvToConv > 0.25) funnelSignals.push(`LP→Conversion rate dropped ${((lwLpvToConv - lpvToConv) / lwLpvToConv * 100).toFixed(0)}% — landing page issue, offer mismatch, or form problem.`)
  if (accountFrequency > 3) funnelSignals.push(`Frequency at ${accountFrequency.toFixed(1)} — audience is seeing ads 3+ times. Creative fatigue risk is HIGH. Consider expanding audience or refreshing creative.`)
  else if (accountFrequency > 2) funnelSignals.push(`Frequency at ${accountFrequency.toFixed(1)} — approaching saturation. Monitor for CPR increases.`)
  if (convRate > 0 && ctr > 2 && convRate < 1) funnelSignals.push(`High CTR (${ctr.toFixed(1)}%) but low conversion (${convRate.toFixed(1)}%) — ad is compelling but landing page/offer isn't converting. Fix the post-click experience.`)

  if (funnelSignals.length > 0) {
    ctx += `\n### Funnel Diagnosis\n`
    for (const s of funnelSignals) ctx += `- ${s}\n`
  }
  ctx += '\n'

  // Previous period comparison
  ctx += `## Previous Period Comparison (${days}d)\n`
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
      const campReach = campaignReach[name]
      const campFreq = campReach && campReach.reach > 0 ? campReach.impressions / campReach.reach : 0
      ctx += `- ${name}: $${d.spend.toFixed(0)} spend, ${d.results} results, $${ccpr.toFixed(2)} CPR, ${cctr.toFixed(2)}% CTR`
      if (campFreq > 0) ctx += `, freq ${campFreq.toFixed(1)}`
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
        if (creative.created_time) {
          const adAge = Math.floor((yesterday.getTime() - new Date(creative.created_time).getTime()) / (1000 * 60 * 60 * 24))
          ctx += `- Age: ${adAge} days (created ${new Date(creative.created_time).toISOString().split('T')[0]})\n`
        }
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

  // === BUDGET vs SPEND ANALYSIS ===
  const campaignBudgets = campaignBudgetRes.data || []
  const adSetBudgets = adSetBudgetRes.data || []
  if (campaignBudgets.length > 0 || adSetBudgets.length > 0) {
    const budgetSignals: string[] = []

    // Campaign-level budgets (CBO)
    for (const camp of campaignBudgets.filter(c => c.status === 'ACTIVE' && c.daily_budget)) {
      const campData = campaigns[camp.name]
      if (!campData) continue
      const dailyBudget = camp.daily_budget
      const avgDailySpend = campData.spend / days
      const utilization = dailyBudget > 0 ? (avgDailySpend / dailyBudget * 100) : 0
      if (utilization < 70) {
        budgetSignals.push(`UNDERSPENDING: "${camp.name}" using ${utilization.toFixed(0)}% of $${dailyBudget}/day budget (avg $${avgDailySpend.toFixed(0)}/day) — audience exhaustion, bid ceiling, or creative issues`)
      } else if (utilization > 95) {
        budgetSignals.push(`BUDGET-CAPPED: "${camp.name}" spending ${utilization.toFixed(0)}% of $${dailyBudget}/day — may be leaving results on the table if CPR is good`)
      }
    }

    // Ad set budgets (ABO)
    for (const as of adSetBudgets.filter(a => a.status === 'ACTIVE' && a.daily_budget)) {
      const asData = adSets[as.name]
      if (!asData) continue
      const dailyBudget = as.daily_budget
      const avgDailySpend = asData.spend / days
      const utilization = dailyBudget > 0 ? (avgDailySpend / dailyBudget * 100) : 0
      if (utilization < 60) {
        budgetSignals.push(`UNDERSPENDING: Ad set "${as.name}" using ${utilization.toFixed(0)}% of $${dailyBudget}/day budget — delivery issue`)
      }
    }

    if (budgetSignals.length > 0) {
      ctx += `## Budget vs Spend Analysis\n`
      for (const s of budgetSignals) ctx += `- ${s}\n`
      ctx += '\n'
    }
  }

  // === AD AGE / CREATIVE LIFECYCLE ===
  const adAgeSignals: string[] = []
  const activeAdsWithAge = (activeAdsRes.data || []).filter(a => a.effective_status === 'ACTIVE' && a.created_time)
  for (const ad of activeAdsWithAge) {
    const adAge = Math.floor((yesterday.getTime() - new Date(ad.created_time).getTime()) / (1000 * 60 * 60 * 24))
    const perf = ads[ad.name]
    if (adAge > 90 && perf && perf.spend > 50) {
      const cprVal = perf.results > 0 ? perf.spend / perf.results : Infinity
      if (perf.results === 0) {
        adAgeSignals.push(`STALE + NO RESULTS: "${ad.name}" is ${adAge} days old, spent $${perf.spend.toFixed(0)} with zero results this period`)
      } else if (account.target_cpl && cprVal > account.target_cpl * 1.5) {
        adAgeSignals.push(`AGING + EXPENSIVE: "${ad.name}" is ${adAge} days old, CPR $${cprVal.toFixed(2)} (${(cprVal / account.target_cpl).toFixed(1)}x target) — likely fatigued`)
      }
    } else if (adAge > 60 && perf && perf.spend > 30) {
      adAgeSignals.push(`WATCH: "${ad.name}" is ${adAge} days old — approaching fatigue window, monitor CPR trends`)
    }
  }

  // Aggregate age stats
  if (activeAdsWithAge.length > 0) {
    const ages = activeAdsWithAge.map(a => Math.floor((yesterday.getTime() - new Date(a.created_time).getTime()) / (1000 * 60 * 60 * 24)))
    const avgAge = ages.reduce((s, a) => s + a, 0) / ages.length
    const maxAge = Math.max(...ages)
    const over60 = ages.filter(a => a > 60).length
    const over90 = ages.filter(a => a > 90).length
    ctx += `## Creative Lifecycle\n`
    ctx += `- Active ads: ${activeAdsWithAge.length} | Avg age: ${avgAge.toFixed(0)} days | Oldest: ${maxAge} days\n`
    ctx += `- Over 60 days: ${over60} ads | Over 90 days: ${over90} ads\n`
    if (over90 > activeAdsWithAge.length * 0.5) ctx += `- WARNING: ${((over90/activeAdsWithAge.length)*100).toFixed(0)}% of active ads are 90+ days old — high creative fatigue risk\n`
  }

  if (adAgeSignals.length > 0) {
    for (const s of adAgeSignals) ctx += `- ${s}\n`
  }
  ctx += '\n'

  // === CAMPAIGN FREQUENCY SIGNALS ===
  const freqSignals: string[] = []
  for (const [name, d] of Object.entries(campaignReach)) {
    if (d.reach === 0 || d.spend < 50) continue
    const freq = d.impressions / d.reach
    if (freq > 4) freqSignals.push(`HIGH FREQUENCY: "${name}" at ${freq.toFixed(1)}x — audience is oversaturated, expect rising CPR`)
    else if (freq > 3) freqSignals.push(`ELEVATED FREQUENCY: "${name}" at ${freq.toFixed(1)}x — approaching fatigue threshold`)
  }
  if (freqSignals.length > 0) {
    ctx += `## Frequency Alerts\n`
    for (const s of freqSignals) ctx += `- ${s}\n`
    ctx += '\n'
  }

  // === DAY-OF-WEEK PATTERNS ===
  if (thisWeek.length >= 7) {
    const dowPerf: Record<string, { spend: number; results: number; count: number }> = {}
    for (const day of thisWeek) {
      const dow = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
      if (!dowPerf[dow]) dowPerf[dow] = { spend: 0, results: 0, count: 0 }
      dowPerf[dow].spend += day.spend || 0
      dowPerf[dow].results += (day.leads || 0) + (day.purchases || 0) + (day.schedules || 0)
      dowPerf[dow].count++
    }
    const dowEntries = Object.entries(dowPerf).filter(([, d]) => d.count > 0 && d.spend > 0)
    if (dowEntries.length >= 5) {
      const avgCPR = dowEntries.reduce((s, [, d]) => s + (d.results > 0 ? d.spend / d.results : 0), 0) / dowEntries.length
      const bestDay = dowEntries.filter(([, d]) => d.results > 0).sort((a, b) => (a[1].spend / a[1].results) - (b[1].spend / b[1].results))[0]
      const worstDay = dowEntries.filter(([, d]) => d.results > 0).sort((a, b) => (b[1].spend / b[1].results) - (a[1].spend / a[1].results))[0]
      if (bestDay && worstDay && bestDay[0] !== worstDay[0]) {
        const bestCPR = bestDay[1].spend / bestDay[1].results
        const worstCPR = worstDay[1].spend / worstDay[1].results
        if (worstCPR > bestCPR * 1.5) {
          ctx += `## Day-of-Week Pattern\n`
          ctx += `- Best day: ${bestDay[0]} ($${bestCPR.toFixed(2)} CPR) | Worst day: ${worstDay[0]} ($${worstCPR.toFixed(2)} CPR)\n`
          ctx += `- ${worstDay[0]} CPR is ${(worstCPR/bestCPR).toFixed(1)}x worse than ${bestDay[0]} — consider dayparting or budget scheduling\n\n`
        }
      }
    }
  }

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

  // === LATEST CREATIVE ANALYSIS (from Creative Studio) ===
  const { data: latestAnalysis } = await supabaseAdmin
    .from('creative_analyses')
    .select('analysis_text, period_days, ads_analyzed, created_at')
    .eq('client_id', client.id)
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestAnalysis?.analysis_text) {
    const ageHours = Math.round((Date.now() - new Date(latestAnalysis.created_at).getTime()) / 3600000)
    const ageDays = Math.round(ageHours / 24)
    const ageLabel = ageDays > 0 ? `${ageDays}d ago` : `${ageHours}h ago`
    const adsCount = Array.isArray(latestAnalysis.ads_analyzed) ? latestAnalysis.ads_analyzed.length : 0

    ctx += `\n## ===== CREATIVE STUDIO INSIGHTS (${latestAnalysis.period_days}d analysis, ${adsCount} ads, ${ageLabel}) =====\n`
    // Include a summary — truncate if very long
    const analysisText = latestAnalysis.analysis_text.length > 3000
      ? latestAnalysis.analysis_text.slice(0, 3000) + '\n[... analysis truncated — full version in Creative Studio]'
      : latestAnalysis.analysis_text
    ctx += analysisText + '\n\n'
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

When CPR goes up, you diagnose the funnel: Is CPM rising (audience saturation/competition)? Is CTR dropping (creative fatigue)? Is click-to-LPV low (landing page load issue)? Is LPV-to-conversion dropping (offer/page problem)? Is frequency above 3 (ad fatigue)? You pinpoint WHERE in the funnel the leak is.

When something works, you ask: Can we scale it? What's the ceiling? Is the budget capped? What would break if we doubled budget? Is frequency already high (limiting headroom)? Are we over-indexed on one winner? How old is the creative (will it last)?

You understand creative lifecycle: ads under 30 days are fresh, 30-60 days need monitoring, 60-90 days are in the fatigue danger zone, 90+ days are likely stale unless proven otherwise by data. You factor ad age into every recommendation.

## Rules

1. ALWAYS cite the FULL HIERARCHY when referencing an ad: Campaign > Ad Set > Ad Name. The user needs to find things in Ads Manager instantly. Example: "In **[Campaign Name] > [Ad Set Name]**, the ad **[Ad Name]** is spending $X with..." Never reference an ad without its campaign and ad set.
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
13. You can SEE images and WATCH videos. When the user asks you to analyze a creative, transcribe a video, describe an ad, or review a visual — the actual media file will be attached to their message. For videos: transcribe ALL spoken words verbatim, describe every scene and transition, analyze the hook (first 3 seconds), pacing, audio, and storytelling. For images: describe all text, layout, colors, composition, and emotional impact. Be thorough — the user wants the FULL picture.

## Your Data

Below is the full account data with automated pre-analysis signals at the bottom. The signals section contains patterns I've already identified — build your analysis on top of these.

The user is ${member?.display_name || user.email} (${member?.role || 'member'}).

${result.context}`

    // Build Gemini messages — detect if the latest message needs media
    const geminiMessages = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const latestUserMsg = messages[messages.length - 1]?.content || ''
    const mediaIntent = detectMediaIntent(latestUserMsg)
    const geminiFilesToCleanup: string[] = []

    // If user is asking about visual/video content, fetch the actual media
    if (mediaIntent.needsMedia && result.client) {
      const activeAds = (await supabaseAdmin
        .from('ads')
        .select('platform_ad_id, name, creative_url, creative_video_url, creative_thumbnail_url, creative_headline, creative_body, effective_status')
        .eq('ad_account_id', (result.client.ad_accounts as any[])?.find((a: any) => a.is_active)?.id || '')
        .in('effective_status', ['ACTIVE', 'PAUSED'])
        .limit(100)
      ).data || []

      const referencedAds = findReferencedAds(latestUserMsg, activeAds)

      if (referencedAds.length > 0) {
        // Replace the last user message with multimodal parts
        const lastMsg = geminiMessages[geminiMessages.length - 1]
        const parts: any[] = []
        const wantsVideo = /transcript|transcribe|watch|video|hook|first 3 sec|audio|what are they saying|scene/i.test(latestUserMsg)

        for (const ad of referencedAds) {
          let videoAttached = false

          // Always try to get video from Meta API if user wants video/transcript
          // Many video ads have creative_video_url=null in our DB but have video_data in Meta
          if (wantsVideo || (ad.creative_video_url && ad.creative_video_url.includes('/video'))) {
            const videoUrl = await getVideoSourceUrl(ad.platform_ad_id)
            if (videoUrl) {
              try {
                const vidRes = await fetch(videoUrl, { signal: AbortSignal.timeout(30000) })
                if (vidRes.ok) {
                  const buffer = await vidRes.arrayBuffer()
                  if (buffer.byteLength > 10240) {
                    const fileUri = await uploadVideoToGemini(buffer, `${ad.platform_ad_id}.mp4`, apiKey)
                    if (fileUri) {
                      geminiFilesToCleanup.push(fileUri)
                      parts.push({ fileData: { mimeType: 'video/mp4', fileUri } })
                      parts.push({ text: `[ACTUAL VIDEO for ad "${ad.name}". Watch it fully — transcribe ALL spoken words verbatim, describe every scene and transition, analyze the hook (first 3 seconds), pacing, audio/music, and storytelling arc. Give a COMPLETE transcript.]` })
                      videoAttached = true
                    }
                  }
                }
              } catch {}
            }
          }

          // Fallback to image if no video attached
          if (!videoAttached && ad.creative_url) {
            const img = await fetchImageBase64(ad.creative_url)
            if (img) {
              parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
              const isKnownVideo = wantsVideo && !videoAttached
              parts.push({ text: isKnownVideo
                ? `[THUMBNAIL/FRAME for ad "${ad.name}" — video could not be downloaded. Analyze what's visible in this frame. Note: the user asked for a transcript but the video file was unavailable.]`
                : `[IMAGE for ad "${ad.name}". Describe everything you see — text, layout, colors, subject, composition.]`
              })
            }
          }
        }

        // Add the user's original text at the end
        parts.push({ text: latestUserMsg })
        lastMsg.parts = parts
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
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
        // Cleanup any uploaded Gemini files
        for (const uri of geminiFilesToCleanup) {
          deleteGeminiFile(uri, apiKey).catch(() => {})
        }
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
