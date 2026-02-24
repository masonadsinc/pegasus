import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { isEcomActionType } from '@/lib/utils'
import { preAnalyze } from '@/lib/analysis'
import { logApiUsage, extractTokenCounts } from '@/lib/api-usage'
const ORG_ID = process.env.ADSINC_ORG_ID!

async function getGeminiKey() {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('gemini_api_key')
    .eq('id', ORG_ID)
    .single()
  const stored = data?.gemini_api_key
  return stored || process.env.GEMINI_API_KEY || null
}

function getDateRange(days: number) {
  const now = new Date()
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const yesterday = new Date(pst); yesterday.setDate(pst.getDate() - 1)
  const start = new Date(yesterday); start.setDate(yesterday.getDate() - (days - 1))
  const prevEnd = new Date(start); prevEnd.setDate(start.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - (days - 1))

  // Week key for DB uniqueness
  const year = yesterday.getFullYear()
  const janFirst = new Date(year, 0, 1)
  const dayOfYear = Math.ceil((yesterday.getTime() - janFirst.getTime()) / 86400000)
  const weekNum = Math.ceil((dayOfYear + janFirst.getDay()) / 7)
  const week = `${year}-W${String(weekNum).padStart(2, '0')}-${days}d`

  return {
    week,
    days,
    periodStart: start.toISOString().split('T')[0],
    periodEnd: yesterday.toISOString().split('T')[0],
    prevStart: prevStart.toISOString().split('T')[0],
    prevEnd: prevEnd.toISOString().split('T')[0],
  }
}

async function generateClientReport(clientId: string, apiKey: string, dates: ReturnType<typeof getDateRange>) {
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*, ad_accounts(*)')
    .eq('org_id', ORG_ID)
    .eq('id', clientId)
    .single()

  if (!client) return null

  const account = (client.ad_accounts as any[])?.find((a: any) => a.is_active)
  if (!account) return { client, error: 'No active ad account' }

  const isEcom = isEcomActionType(account.primary_action_type)

  // Build name maps from entity tables
  const [{ data: campaignEntities }, { data: adSetEntities }, { data: adEntities }] = await Promise.all([
    supabaseAdmin.from('campaigns').select('platform_campaign_id, name').eq('ad_account_id', account.id),
    supabaseAdmin.from('ad_sets').select('platform_ad_set_id, name').eq('ad_account_id', account.id),
    supabaseAdmin.from('ads').select('platform_ad_id, name, created_time').eq('ad_account_id', account.id),
  ])

  const campNameMap = new Map<string, string>()
  for (const c of (campaignEntities || [])) campNameMap.set(c.platform_campaign_id, c.name)
  const adSetNameMap = new Map<string, string>()
  for (const as of (adSetEntities || [])) adSetNameMap.set(as.platform_ad_set_id, as.name)
  const adNameMap = new Map<string, string>()
  const adCreatedMap = new Map<string, string>()
  for (const a of (adEntities || [])) {
    adNameMap.set(a.platform_ad_id, a.name)
    if (a.created_time) adCreatedMap.set(a.platform_ad_id, a.created_time)
  }

  // Fetch insights
  const [{ data: rawInsights }, { data: campaignData }, { data: adInsights }, { data: placementData }, { data: ageGenderData }] = await Promise.all([
    supabaseAdmin
      .from('insights')
      .select('date, level, spend, impressions, clicks, reach, leads, purchases, purchase_value, schedules, landing_page_views')
      .eq('ad_account_id', account.id)
      .in('level', ['account', 'campaign'])
      .gte('date', dates.prevStart)
      .lte('date', dates.periodEnd)
      .order('date')
      .limit(2000),
    supabaseAdmin
      .from('insights')
      .select('platform_campaign_id, spend, impressions, clicks, reach, leads, purchases, purchase_value, schedules, landing_page_views')
      .eq('ad_account_id', account.id)
      .eq('level', 'campaign')
      .gte('date', dates.periodStart)
      .lte('date', dates.periodEnd)
      .limit(2000),
    supabaseAdmin
      .from('insights')
      .select('platform_ad_id, platform_campaign_id, platform_ad_set_id, spend, impressions, clicks, leads, purchases, schedules, purchase_value')
      .eq('ad_account_id', account.id)
      .eq('level', 'ad')
      .gte('date', dates.periodStart)
      .lte('date', dates.periodEnd)
      .limit(2000),
    supabaseAdmin
      .from('insight_breakdowns')
      .select('dimension_1, dimension_2, spend, impressions, clicks, leads, purchases, purchase_value')
      .eq('ad_account_id', account.id)
      .eq('breakdown_type', 'placement')
      .gte('date', dates.periodStart)
      .lte('date', dates.periodEnd)
      .limit(500),
    supabaseAdmin
      .from('insight_breakdowns')
      .select('dimension_1, dimension_2, spend, impressions, clicks, leads, purchases, purchase_value')
      .eq('ad_account_id', account.id)
      .eq('breakdown_type', 'age_gender')
      .gte('date', dates.periodStart)
      .lte('date', dates.periodEnd)
      .limit(500),
  ])

  // Process insights
  const hasAccountLevel = (rawInsights || []).some(i => i.level === 'account')
  let insights: any[]
  if (hasAccountLevel) {
    insights = (rawInsights || []).filter(i => i.level === 'account')
  } else {
    const byDate: Record<string, any> = {}
    for (const row of (rawInsights || []).filter(i => i.level === 'campaign')) {
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
    insights = Object.values(byDate).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
  }

  const thisWeek = insights.filter(i => i.date >= dates.periodStart && i.date <= dates.periodEnd)
  const lastWeek = insights.filter(i => i.date >= dates.prevStart && i.date < dates.periodStart)

  const agg = (rows: any[]) => rows.reduce((s, i) => ({
    spend: s.spend + (i.spend || 0),
    impressions: s.impressions + (i.impressions || 0),
    clicks: s.clicks + (i.clicks || 0),
    reach: s.reach + (i.reach || 0),
    results: s.results + (i.leads || 0) + (i.purchases || 0) + (i.schedules || 0),
    revenue: s.revenue + (i.purchase_value || 0),
    lpv: s.lpv + (i.landing_page_views || 0),
  }), { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, revenue: 0, lpv: 0 })

  const tw = agg(thisWeek)
  const lw = agg(lastWeek)

  // Campaign breakdown (with name resolution)
  const campaigns: Record<string, any> = {}
  for (const ci of (campaignData || [])) {
    const name = campNameMap.get(ci.platform_campaign_id) || ci.platform_campaign_id || 'Unknown'
    if (!campaigns[name]) campaigns[name] = { spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0, reach: 0 }
    campaigns[name].spend += ci.spend || 0
    campaigns[name].results += (ci.leads || 0) + (ci.purchases || 0) + (ci.schedules || 0)
    campaigns[name].clicks += ci.clicks || 0
    campaigns[name].impressions += ci.impressions || 0
    campaigns[name].revenue += ci.purchase_value || 0
    campaigns[name].reach += ci.reach || 0
  }

  // Ad breakdown (with name resolution)
  const ads: Record<string, any> = {}
  for (const ai of (adInsights || [])) {
    const name = adNameMap.get(ai.platform_ad_id) || ai.platform_ad_id || 'Unknown'
    const campName = campNameMap.get(ai.platform_campaign_id) || ai.platform_campaign_id || 'Unknown'
    if (!ads[name]) ads[name] = { campaign: campName, spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0, platformId: ai.platform_ad_id }
    ads[name].spend += ai.spend || 0
    ads[name].results += (ai.leads || 0) + (ai.purchases || 0) + (ai.schedules || 0)
    ads[name].clicks += ai.clicks || 0
    ads[name].impressions += ai.impressions || 0
    ads[name].revenue += ai.purchase_value || 0
  }

  const sortedAds = Object.entries(ads).sort((a, b) => b[1].spend - a[1].spend)
  const topPerformers = sortedAds.filter(([, d]) => d.results >= 2).sort((a, b) => (a[1].spend / a[1].results) - (b[1].spend / b[1].results)).slice(0, 5)
  const targetCpl = account.target_cpl || (tw.results > 0 ? tw.spend / tw.results * 1.5 : 50)
  const nonConverting = sortedAds.filter(([, d]) => d.results === 0 && d.spend > targetCpl)
  const highCost = sortedAds.filter(([, d]) => d.results > 0 && (d.spend / d.results) > targetCpl * 2).slice(0, 3)

  // Previous report for continuity
  const { data: prevReport } = await supabaseAdmin
    .from('weekly_reports')
    .select('content')
    .eq('client_id', clientId)
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Derived metrics
  const cpr = tw.results > 0 ? tw.spend / tw.results : 0
  const lwCpr = lw.results > 0 ? lw.spend / lw.results : 0
  const ctr = tw.impressions > 0 ? (tw.clicks / tw.impressions * 100) : 0
  const cpc = tw.clicks > 0 ? tw.spend / tw.clicks : 0
  const roas = tw.spend > 0 ? tw.revenue / tw.spend : 0
  const freq = tw.reach > 0 ? tw.impressions / tw.reach : 0
  const cpm = tw.impressions > 0 ? (tw.spend / tw.impressions * 1000) : 0
  const lpvRate = tw.clicks > 0 && tw.lpv > 0 ? (tw.lpv / tw.clicks * 100) : 0
  const lpvConvRate = tw.lpv > 0 && tw.results > 0 ? (tw.results / tw.lpv * 100) : 0

  const periodLabel = dates.days === 7 ? 'week' : `${dates.days} days`

  let dataContext = `CLIENT: ${client.name}
PERIOD: ${dates.periodStart} to ${dates.periodEnd} (${dates.days} days)
METRIC TYPE: ${isEcom ? 'ROAS (e-commerce)' : 'CPL (lead gen)'}
${isEcom ? `TARGET ROAS: ${account.target_roas || 'not set'}x` : `TARGET CPL: $${account.target_cpl || 'not set'}`}
CONVERSION TYPE: ${account.primary_action_type || 'lead'}

THIS PERIOD (${dates.days}d):
- Spend: $${tw.spend.toFixed(2)}
- Results: ${tw.results}
- ${isEcom ? `ROAS: ${roas.toFixed(2)}x | Revenue: $${tw.revenue.toFixed(2)}` : `CPL: $${cpr.toFixed(2)}`}
- Impressions: ${tw.impressions.toLocaleString()} | Clicks: ${tw.clicks.toLocaleString()}
- CTR: ${ctr.toFixed(2)}% | CPC: $${cpc.toFixed(2)} | CPM: $${cpm.toFixed(2)}
${freq > 0 ? `- Frequency: ${freq.toFixed(2)} | Reach: ${tw.reach.toLocaleString()}` : ''}
${tw.lpv > 0 ? `- Landing Page Views: ${tw.lpv} | Click-to-LPV: ${lpvRate.toFixed(1)}% | LPV-to-Conv: ${lpvConvRate.toFixed(2)}%` : ''}

PREVIOUS PERIOD (${dates.days}d):
- Spend: $${lw.spend.toFixed(2)} | Results: ${lw.results}
- ${isEcom ? `Revenue: $${lw.revenue.toFixed(2)}` : `CPL: $${lwCpr.toFixed(2)}`}
- Spend change: ${lw.spend > 0 ? ((tw.spend - lw.spend) / lw.spend * 100).toFixed(1) + '%' : 'N/A'}
- ${isEcom ? '' : `CPL change: ${lwCpr > 0 && cpr > 0 ? ((cpr - lwCpr) / lwCpr * 100).toFixed(1) + '%' : 'N/A'}`}

DAILY BREAKDOWN:
${thisWeek.map(d => {
  const dr = (d.leads || 0) + (d.purchases || 0) + (d.schedules || 0)
  return `${d.date}: $${(d.spend || 0).toFixed(0)} spent, ${dr} results`
}).join('\n')}

CAMPAIGNS (by spend):
${Object.entries(campaigns).sort((a, b) => b[1].spend - a[1].spend).slice(0, 10).map(([name, d]) => {
  const ccpr = d.results > 0 ? d.spend / d.results : 0
  const cfreq = d.reach > 0 ? d.impressions / d.reach : 0
  return `- ${name}: $${d.spend.toFixed(0)} spend, ${d.results} results, $${ccpr.toFixed(2)} CPR${cfreq > 0 ? `, freq ${cfreq.toFixed(1)}` : ''}`
}).join('\n')}

TOP PERFORMERS:
${topPerformers.length > 0 ? topPerformers.map(([name, d]) => {
  const acpr = d.spend / d.results
  const created = d.platformId ? adCreatedMap.get(d.platformId) : null
  const age = created ? Math.floor((new Date(dates.periodEnd).getTime() - new Date(created).getTime()) / 86400000) : null
  return `- "${name}" (${d.campaign}): $${d.spend.toFixed(0)} spend, ${d.results} results, $${acpr.toFixed(2)} CPR${age ? `, ${age} days old` : ''}`
}).join('\n') : 'No standout performers this period.'}

UNDERPERFORMERS:
${nonConverting.length > 0 ? `Non-converting ads (0 results, significant spend):\n${nonConverting.slice(0, 5).map(([name, d]) => `- "${name}" (${d.campaign}): $${d.spend.toFixed(0)} spent, 0 results`).join('\n')}\nTotal wasted: $${nonConverting.reduce((s, [, d]) => s + d.spend, 0).toFixed(0)}` : 'No major wasted spend this period.'}
${highCost.length > 0 ? `\nHigh-cost ads (converting but expensive):\n${highCost.map(([name, d]) => `- "${name}": $${(d.spend / d.results).toFixed(2)} CPR (${d.results} results)`).join('\n')}` : ''}`

  // Placement breakdown
  if (placementData && placementData.length > 0) {
    const placements: Record<string, { spend: number; results: number }> = {}
    for (const row of placementData) {
      const key = `${row.dimension_1 || 'Unknown'} — ${row.dimension_2 || 'Unknown'}`
      if (!placements[key]) placements[key] = { spend: 0, results: 0 }
      placements[key].spend += row.spend || 0
      placements[key].results += (row.leads || 0) + (row.purchases || 0)
    }
    dataContext += `\n\nPLACEMENT BREAKDOWN:\n${Object.entries(placements).sort((a, b) => b[1].spend - a[1].spend).slice(0, 8).map(([name, d]) => {
      const pcpr = d.results > 0 ? d.spend / d.results : 0
      return `- ${name}: $${d.spend.toFixed(0)} spend, ${d.results} results${d.results > 0 ? `, $${pcpr.toFixed(2)} CPR` : ''}`
    }).join('\n')}`
  }

  // Audience breakdown
  if (ageGenderData && ageGenderData.length > 0) {
    const ages: Record<string, { spend: number; results: number }> = {}
    for (const row of ageGenderData) {
      const age = row.dimension_1 || 'Unknown'
      if (!ages[age]) ages[age] = { spend: 0, results: 0 }
      ages[age].spend += row.spend || 0
      ages[age].results += (row.leads || 0) + (row.purchases || 0)
    }
    dataContext += `\n\nAUDIENCE (Age):\n${Object.entries(ages).sort((a, b) => b[1].spend - a[1].spend).map(([age, d]) => {
      const acpr = d.results > 0 ? d.spend / d.results : 0
      return `- ${age}: $${d.spend.toFixed(0)} spend, ${d.results} results${d.results > 0 ? `, $${acpr.toFixed(2)} CPR` : ''}`
    }).join('\n')}`
  }

  // Pre-analysis signals
  const dayData = thisWeek.map(d => ({
    date: d.date, spend: d.spend || 0, impressions: d.impressions || 0, clicks: d.clicks || 0,
    results: (d.leads || 0) + (d.purchases || 0) + (d.schedules || 0), revenue: d.purchase_value || 0, lpv: d.landing_page_views || 0,
  }))
  const lwDayData = lastWeek.map(d => ({
    date: d.date, spend: d.spend || 0, impressions: d.impressions || 0, clicks: d.clicks || 0,
    results: (d.leads || 0) + (d.purchases || 0) + (d.schedules || 0), revenue: d.purchase_value || 0, lpv: 0,
  }))
  const adArr = sortedAds.map(([name, d]) => ({ name, campaign: d.campaign, adSet: '', spend: d.spend, results: d.results, clicks: d.clicks, impressions: d.impressions, revenue: d.revenue }))
  const campArr = Object.entries(campaigns).map(([name, d]) => ({ name, spend: d.spend, results: d.results, clicks: d.clicks, impressions: d.impressions, revenue: d.revenue }))
  const analysis = preAnalyze(dayData, lwDayData, adArr, campArr, account.target_cpl, isEcom, account.target_roas)

  if (analysis.signals.length > 0) {
    dataContext += `\n\nKEY SIGNALS:\n${analysis.signals.map(s => `- ${s}`).join('\n')}`
  }
  if (analysis.scalingOpportunities.length > 0) {
    dataContext += `\n\nSCALING OPPORTUNITIES:\n${analysis.scalingOpportunities.map(s => `- ${s}`).join('\n')}`
  }
  if (analysis.fatigueSignals.length > 0) {
    dataContext += `\n\nFATIGUE SIGNALS:\n${analysis.fatigueSignals.map(s => `- ${s}`).join('\n')}`
  }

  // Client context
  if (client.business_description) dataContext += `\n\nBUSINESS: ${client.business_description}`
  if (client.offer_service) dataContext += `\nOFFER: ${client.offer_service}`
  if (client.target_audience) dataContext += `\nAUDIENCE: ${client.target_audience}`
  if (client.kpi_goals) dataContext += `\nGOALS: ${client.kpi_goals}`
  if (client.ai_notes) dataContext += `\nNOTES: ${client.ai_notes}`

  if (prevReport?.content) {
    dataContext += `\n\nPREVIOUS REPORT (for continuity):\n${prevReport.content.slice(0, 2000)}`
  }

  const systemPrompt = `You are writing a ${dates.days}-day performance report email for a Meta advertising client. Write as Brianna, a hands-on media buyer who manages the account.

RULES:
- Open with 2-3 sentences summarizing the period — lead with the most important number or trend
- Use ALL CAPS section headers: THE NUMBERS, WHAT'S WORKING, WHAT'S NOT WORKING (only if applicable), THE PLAN
- Use dashes for bullets, **bold** for emphasis, no ## headers, no italics
- Be conversational but professional — this goes directly to the client
- Use "we" not "I" — it's a team
- Be honest about bad periods but always constructive
- Reference specific numbers, ad names, and campaigns by name
- 300-500 words total
- If previous report exists, reference what changed
- Always sign off with exactly: "Thanks,\nBrianna" (on two lines)
- No emojis anywhere
- Format must look clean in email (Gmail, Outlook, Apple Mail)

${isEcom ? 'This is an e-commerce account — focus on ROAS and revenue, not CPL.' : 'This is a lead gen account — focus on CPL and lead volume.'}`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: dataContext }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error('Gemini error for', client.name, err)
    return { client, error: 'AI generation failed' }
  }

  const result = await response.json()
  const tok = extractTokenCounts(result)
  logApiUsage({ model: 'gemini-3-flash-preview', feature: 'report-generation', inputTokens: tok.inputTokens, outputTokens: tok.outputTokens, metadata: { clientName: client.name } })
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text || ''

  const subject = `${client.name} - Meta Ads Report - ${formatDateRange(dates.periodStart, dates.periodEnd)}`

  return { client, content, subject }
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = await getGeminiKey()
    if (!apiKey) return NextResponse.json({ error: 'No Gemini API key configured' }, { status: 400 })

    const body = await req.json()
    const clientIds: string[] | null = body.clientIds
    const days: number = Math.min(Math.max(body.days || 7, 7), 90)
    const dates = getDateRange(days)

    let query = supabaseAdmin
      .from('clients')
      .select('id, name')
      .eq('org_id', ORG_ID)
      .eq('status', 'active')

    if (clientIds?.length) {
      query = query.in('id', clientIds)
    }

    const { data: clients } = await query
    if (!clients?.length) return NextResponse.json({ error: 'No clients found' }, { status: 404 })

    const results = []

    for (const c of clients) {
      try {
        const result = await generateClientReport(c.id, apiKey, dates)
        if (!result || result.error) {
          results.push({ client: c.name, status: 'error', error: result?.error || 'Unknown error' })
          continue
        }

        const { error: upsertError } = await supabaseAdmin
          .from('weekly_reports')
          .upsert({
            org_id: ORG_ID,
            client_id: c.id,
            client_name: c.name,
            week: dates.week,
            period_start: dates.periodStart,
            period_end: dates.periodEnd,
            subject: result.subject,
            content: result.content,
            status: 'draft',
            generated_at: new Date().toISOString(),
          }, { onConflict: 'org_id,client_id,week' })

        if (upsertError) {
          results.push({ client: c.name, status: 'error', error: upsertError.message })
        } else {
          results.push({ client: c.name, status: 'generated' })
        }
      } catch (e: any) {
        results.push({ client: c.name, status: 'error', error: e.message })
      }
    }

    await supabaseAdmin.from('activity_log').insert({
      org_id: ORG_ID,
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.email,
      action: 'generated reports',
      target_type: 'report',
      details: `${dates.days}d report (${dates.periodStart} to ${dates.periodEnd}): ${results.filter(r => r.status === 'generated').length}/${results.length} generated`,
    })

    return NextResponse.json({ week: dates.week, dates, results })
  } catch (e: any) {
    console.error('Report generation error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
