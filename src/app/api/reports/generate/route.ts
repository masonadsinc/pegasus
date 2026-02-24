import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { isEcomActionType } from '@/lib/utils'
const ORG_ID = process.env.ADSINC_ORG_ID!

async function getGeminiKey() {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('gemini_api_key')
    .eq('id', ORG_ID)
    .single()
  const stored = data?.gemini_api_key
  if (!stored) return process.env.GEMINI_API_KEY || null
  try {
    return stored
  } catch {
    return process.env.GEMINI_API_KEY || null
  }
}

function getWeekDates() {
  const now = new Date()
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const yesterday = new Date(pst); yesterday.setDate(pst.getDate() - 1)
  const weekAgo = new Date(yesterday); weekAgo.setDate(yesterday.getDate() - 6)

  const year = yesterday.getFullYear()
  const janFirst = new Date(year, 0, 1)
  const dayOfYear = Math.ceil((yesterday.getTime() - janFirst.getTime()) / 86400000)
  const weekNum = Math.ceil((dayOfYear + janFirst.getDay()) / 7)
  const week = `${year}-W${String(weekNum).padStart(2, '0')}`

  return {
    week,
    periodStart: weekAgo.toISOString().split('T')[0],
    periodEnd: yesterday.toISOString().split('T')[0],
    prevStart: new Date(weekAgo.getTime() - 7 * 86400000).toISOString().split('T')[0],
    prevEnd: new Date(weekAgo.getTime() - 86400000).toISOString().split('T')[0],
  }
}

async function generateClientReport(clientId: string, apiKey: string, dates: ReturnType<typeof getWeekDates>) {
  // Get client + account
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

  // This week + last week insights
  const { data: insights } = await supabaseAdmin
    .from('insights')
    .select('date, spend, impressions, clicks, leads, purchases, purchase_value, schedules, landing_page_views')
    .eq('ad_account_id', account.id)
    .eq('level', 'account')
    .gte('date', dates.prevStart)
    .lte('date', dates.periodEnd)
    .order('date')
    .limit(500)

  const thisWeek = (insights || []).filter(i => i.date >= dates.periodStart && i.date <= dates.periodEnd)
  const lastWeek = (insights || []).filter(i => i.date >= dates.prevStart && i.date < dates.periodStart)

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

  // Campaign breakdown
  const { data: campaignData } = await supabaseAdmin
    .from('insights')
    .select('campaign_name, spend, impressions, clicks, leads, purchases, purchase_value, schedules')
    .eq('ad_account_id', account.id)
    .eq('level', 'campaign')
    .gte('date', dates.periodStart)
    .lte('date', dates.periodEnd)
    .limit(500)

  const campaigns: Record<string, any> = {}
  for (const ci of (campaignData || [])) {
    const name = ci.campaign_name || 'Unknown'
    if (!campaigns[name]) campaigns[name] = { spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
    campaigns[name].spend += ci.spend || 0
    campaigns[name].results += (ci.leads || 0) + (ci.purchases || 0) + (ci.schedules || 0)
    campaigns[name].clicks += ci.clicks || 0
    campaigns[name].impressions += ci.impressions || 0
    campaigns[name].revenue += ci.purchase_value || 0
  }

  // Top/bottom ads
  const { data: adInsights } = await supabaseAdmin
    .from('insights')
    .select('ad_name, campaign_name, spend, impressions, clicks, leads, purchases, schedules, purchase_value')
    .eq('ad_account_id', account.id)
    .eq('level', 'ad')
    .gte('date', dates.periodStart)
    .lte('date', dates.periodEnd)
    .limit(1000)

  const ads: Record<string, any> = {}
  for (const ai of (adInsights || [])) {
    const name = ai.ad_name || 'Unknown'
    if (!ads[name]) ads[name] = { campaign: ai.campaign_name, spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
    ads[name].spend += ai.spend || 0
    ads[name].results += (ai.leads || 0) + (ai.purchases || 0) + (ai.schedules || 0)
    ads[name].clicks += ai.clicks || 0
    ads[name].impressions += ai.impressions || 0
    ads[name].revenue += ai.purchase_value || 0
  }

  const sortedAds = Object.entries(ads).sort((a, b) => b[1].spend - a[1].spend)
  const topPerformers = sortedAds.filter(([, d]) => d.results >= 2).sort((a, b) => {
    const aCpr = a[1].spend / a[1].results
    const bCpr = b[1].spend / b[1].results
    return aCpr - bCpr
  }).slice(0, 3)
  const targetCpl = account.target_cpl || (tw.results > 0 ? tw.spend / tw.results * 1.5 : 50)
  const nonConverting = sortedAds.filter(([, d]) => d.results === 0 && d.spend > targetCpl)
  const highCost = sortedAds.filter(([, d]) => d.results > 0 && (d.spend / d.results) > targetCpl * 2).slice(0, 3)

  // Previous report for continuity
  const { data: prevReport } = await supabaseAdmin
    .from('weekly_reports')
    .select('content')
    .eq('client_id', clientId)
    .eq('org_id', ORG_ID)
    .neq('week', dates.week)
    .order('week', { ascending: false })
    .limit(1)
    .single()

  // Build Gemini prompt
  const cpr = tw.results > 0 ? tw.spend / tw.results : 0
  const lwCpr = lw.results > 0 ? lw.spend / lw.results : 0
  const ctr = tw.impressions > 0 ? (tw.clicks / tw.impressions * 100) : 0
  const cpc = tw.clicks > 0 ? tw.spend / tw.clicks : 0
  const roas = tw.spend > 0 ? tw.revenue / tw.spend : 0

  let dataContext = `CLIENT: ${client.name}
PERIOD: ${dates.periodStart} to ${dates.periodEnd}
METRIC TYPE: ${isEcom ? 'ROAS (e-commerce)' : 'CPL (lead gen)'}
${isEcom ? `TARGET ROAS: ${account.target_roas || 'not set'}x` : `TARGET CPL: $${account.target_cpl || 'not set'}`}
CONVERSION TYPE: ${account.primary_action_type || 'lead'}

THIS WEEK:
- Spend: $${tw.spend.toFixed(2)}
- Results: ${tw.results}
- ${isEcom ? `ROAS: ${roas.toFixed(2)}x | Revenue: $${tw.revenue.toFixed(2)}` : `CPL: $${cpr.toFixed(2)}`}
- Impressions: ${tw.impressions.toLocaleString()} | Clicks: ${tw.clicks.toLocaleString()}
- CTR: ${ctr.toFixed(2)}% | CPC: $${cpc.toFixed(2)}

LAST WEEK:
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
${Object.entries(campaigns).sort((a, b) => b[1].spend - a[1].spend).slice(0, 8).map(([name, d]) => {
  const ccpr = d.results > 0 ? d.spend / d.results : 0
  return `- ${name}: $${d.spend.toFixed(0)} spend, ${d.results} results, $${ccpr.toFixed(2)} CPR`
}).join('\n')}

TOP PERFORMERS:
${topPerformers.length > 0 ? topPerformers.map(([name, d]) => {
  const acpr = d.spend / d.results
  return `- "${name}" (${d.campaign}): $${d.spend.toFixed(0)} spend, ${d.results} results, $${acpr.toFixed(2)} CPR`
}).join('\n') : 'No standout performers this week.'}

UNDERPERFORMERS:
${nonConverting.length > 0 ? `Non-converting ads (0 results, significant spend):\n${nonConverting.slice(0, 5).map(([name, d]) => `- "${name}": $${d.spend.toFixed(0)} spent, 0 results`).join('\n')}\nTotal wasted: $${nonConverting.reduce((s, [, d]) => s + d.spend, 0).toFixed(0)}` : 'No major wasted spend this week.'}
${highCost.length > 0 ? `\nHigh-cost ads (converting but expensive):\n${highCost.map(([name, d]) => `- "${name}": $${(d.spend / d.results).toFixed(2)} CPR (${d.results} results)`).join('\n')}` : ''}`

  // Client context
  if (client.business_description) dataContext += `\n\nBUSINESS: ${client.business_description}`
  if (client.offer_service) dataContext += `\nOFFER: ${client.offer_service}`
  if (client.target_audience) dataContext += `\nAUDIENCE: ${client.target_audience}`
  if (client.kpi_goals) dataContext += `\nGOALS: ${client.kpi_goals}`
  if (client.ai_notes) dataContext += `\nNOTES: ${client.ai_notes}`

  if (prevReport?.content) {
    dataContext += `\n\nLAST WEEK'S REPORT (for continuity — reference previous recommendations and whether things improved):\n${prevReport.content.slice(0, 2000)}`
  }

  const systemPrompt = `You are writing a weekly performance report email for a Meta advertising client. Write as Brianna, a hands-on media buyer who manages the account.

RULES:
- Open with 2-3 sentences summarizing the week — lead with the most important number
- Use ALL CAPS section headers: THE NUMBERS, WHAT'S WORKING, WHAT'S NOT WORKING (only if applicable), THE PLAN
- Use dashes for bullets, **bold** for emphasis, no ## headers, no italics
- Be conversational but professional — this goes directly to the client
- Use "we" not "I" — it's a team
- Be honest about bad weeks but always constructive
- Reference specific numbers, ad names, and campaigns
- 300-500 words total
- If previous report exists, reference what changed since last week
- Sign off with just "Brianna"
- No emojis anywhere
- Format must look clean in email (Gmail, Outlook, Apple Mail)

${isEcom ? 'This is an e-commerce account — focus on ROAS and revenue, not CPL.' : 'This is a lead gen account — focus on CPL and lead volume.'}`

  // Call Gemini
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
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

// POST /api/reports/generate — generate reports for a week
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = await getGeminiKey()
    if (!apiKey) return NextResponse.json({ error: 'No Gemini API key configured' }, { status: 400 })

    const body = await req.json()
    const clientIds: string[] = body.clientIds // specific clients, or null for all
    const dates = getWeekDates()

    // Get active clients with ad accounts
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

        // Upsert report
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
      action: 'generated weekly reports',
      target_type: 'report',
      details: `Week ${dates.week}: ${results.filter(r => r.status === 'generated').length}/${results.length} generated`,
    })

    return NextResponse.json({ week: dates.week, dates, results })
  } catch (e: any) {
    console.error('Report generation error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
