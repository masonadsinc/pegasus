import { NextRequest } from 'next/server'
import { getUser, getUserOrgRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isEcomActionType } from '@/lib/utils'

const ORG_ID = process.env.ADSINC_ORG_ID!

async function getOrgGeminiKey() {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('gemini_api_key')
    .eq('id', ORG_ID)
    .single()
  return data?.gemini_api_key || process.env.GEMINI_API_KEY || null
}

async function getAccountContext(days = 7) {
  const now = new Date()
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const yesterday = new Date(pst); yesterday.setDate(pst.getDate() - 1)
  const daysAgo = new Date(pst); daysAgo.setDate(pst.getDate() - days)
  const prevStart = new Date(pst); prevStart.setDate(pst.getDate() - days * 2)
  const yStr = yesterday.toISOString().split('T')[0]
  const dStr = daysAgo.toISOString().split('T')[0]
  const pStr = prevStart.toISOString().split('T')[0]

  const { data: accounts } = await supabaseAdmin
    .from('ad_accounts')
    .select('id, name, platform_account_id, primary_action_type, target_cpl, target_roas, objective, clients!inner(name, slug, monthly_retainer, industry)')
    .eq('org_id', ORG_ID)
    .eq('is_active', true)

  if (!accounts?.length) return 'No active accounts found.'

  const { data: insights } = await supabaseAdmin
    .from('insights')
    .select('ad_account_id, date, spend, impressions, clicks, leads, purchases, purchase_value, schedules, landing_page_views')
    .eq('level', 'account')
    .gte('date', pStr)
    .lte('date', yStr)
    .in('ad_account_id', accounts.map(a => a.id))
    .order('date', { ascending: true })
    .limit(5000)

  let context = `Agency Performance Summary (Last ${days} days, data through ${yStr}):\n\n`

  let totalSpend = 0, totalResults = 0, totalImpressions = 0, totalClicks = 0

  for (const acc of accounts) {
    const client = acc.clients as any
    const accInsights = (insights || []).filter(i => i.ad_account_id === acc.id)
    const thisWeek = accInsights.filter(i => i.date > dStr && i.date <= yStr)
    const lastWeek = accInsights.filter(i => i.date >= pStr && i.date <= dStr)

    const tw = thisWeek.reduce((s, i) => ({
      spend: s.spend + (i.spend || 0), impressions: s.impressions + (i.impressions || 0),
      clicks: s.clicks + (i.clicks || 0), results: s.results + (i.leads || 0) + (i.purchases || 0) + (i.schedules || 0),
      purchase_value: s.purchase_value + (i.purchase_value || 0), lpv: s.lpv + (i.landing_page_views || 0),
    }), { spend: 0, impressions: 0, clicks: 0, results: 0, purchase_value: 0, lpv: 0 })

    const lw = lastWeek.reduce((s, i) => ({
      spend: s.spend + (i.spend || 0), results: s.results + (i.leads || 0) + (i.purchases || 0) + (i.schedules || 0),
    }), { spend: 0, results: 0 })

    if (tw.spend === 0 && lw.spend === 0) continue

    totalSpend += tw.spend; totalResults += tw.results; totalImpressions += tw.impressions; totalClicks += tw.clicks

    const cpr = tw.results > 0 ? tw.spend / tw.results : 0
    const lwCpr = lw.results > 0 ? lw.spend / lw.results : 0
    const ctr = tw.impressions > 0 ? (tw.clicks / tw.impressions) * 100 : 0
    const cpc = tw.clicks > 0 ? tw.spend / tw.clicks : 0
    const convRate = tw.clicks > 0 ? (tw.results / tw.clicks) * 100 : 0
    const isEcom = isEcomActionType(acc.primary_action_type)
    const roas = tw.spend > 0 ? tw.purchase_value / tw.spend : 0

    const cprWow = lwCpr > 0 && cpr > 0 ? ((cpr - lwCpr) / lwCpr * 100).toFixed(0) : 'N/A'
    const spendWow = lw.spend > 0 ? ((tw.spend - lw.spend) / lw.spend * 100).toFixed(0) : 'N/A'

    let status = 'OK'
    if (acc.target_cpl && cpr > 0) {
      const pctOver = ((cpr / acc.target_cpl) - 1) * 100
      if (pctOver > 25) status = 'CRITICAL - ' + pctOver.toFixed(0) + '% over target'
      else if (pctOver > 0) status = 'WARNING - ' + pctOver.toFixed(0) + '% over target'
      else status = 'ON TARGET (' + Math.abs(pctOver).toFixed(0) + '% under)'
    }

    context += `## ${client.name}\n`
    context += `- Status: ${status}\n`
    context += `- Spend: $${tw.spend.toFixed(0)} (WoW: ${spendWow}%) | Results: ${tw.results} | CPR: $${cpr.toFixed(2)} (WoW: ${cprWow}%)\n`
    if (acc.target_cpl) context += `- Target CPL: $${acc.target_cpl}\n`
    if (isEcom) context += `- ROAS: ${roas.toFixed(2)}x | Revenue: $${tw.purchase_value.toFixed(0)}\n`
    context += `- CTR: ${ctr.toFixed(2)}% | CPC: $${cpc.toFixed(2)} | Conv Rate: ${convRate.toFixed(2)}%\n`
    if (client.monthly_retainer) context += `- Retainer: $${client.monthly_retainer}/mo\n`
    context += `- Action type: ${acc.primary_action_type || 'lead'}\n\n`
  }

  context += `\n## Agency Totals\n`
  context += `- Total Spend: $${totalSpend.toFixed(0)} | Total Results: ${totalResults}\n`
  context += `- Blended CPR: $${totalResults > 0 ? (totalSpend / totalResults).toFixed(2) : 'N/A'}\n`
  context += `- Blended CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 'N/A'}%\n`

  return context
}

async function getClientDetail(clientName: string) {
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*, ad_accounts(*)')
    .eq('org_id', ORG_ID)
    .ilike('name', `%${clientName}%`)
    .limit(1)
    .single()

  if (!client) return null

  const account = (client.ad_accounts as any[])?.find((a: any) => a.is_active)
  if (!account) return `${client.name}: No active ad account.`

  const { data: topAds } = await supabaseAdmin
    .from('ads')
    .select('name, creative_headline, creative_body, creative_cta, effective_status')
    .eq('ad_account_id', account.id)
    .eq('effective_status', 'ACTIVE')
    .limit(10)

  let detail = `\n## ${client.name} — Detail\n`
  detail += `- Industry: ${client.industry || 'N/A'} | Status: ${client.status}\n`
  detail += `- Retainer: $${client.monthly_retainer || 0}/mo | Rev share: ${client.rev_share_pct || 0}%\n`
  detail += `- Account: ${account.name} (act_${account.platform_account_id})\n`
  detail += `- Target CPL: $${account.target_cpl || 'not set'} | Objective: ${account.objective || 'N/A'}\n`

  if (topAds?.length) {
    detail += `\nActive ads (${topAds.length}):\n`
    for (const ad of topAds.slice(0, 5)) {
      detail += `- "${ad.name}" | Headline: "${ad.creative_headline || 'N/A'}" | CTA: ${ad.creative_cta || 'N/A'}\n`
    }
  }

  return detail
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

    const { messages, clientFocus } = await req.json()
    if (!messages?.length) return new Response(JSON.stringify({ error: 'No messages' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

    // Build context
    let context = await getAccountContext(7)
    if (clientFocus) {
      const detail = await getClientDetail(clientFocus)
      if (detail) context += '\n' + detail
    }

    // Check if user is asking about a specific client
    const lastMsg = messages[messages.length - 1]?.content || ''
    const clientMentionMatch = lastMsg.match(/(?:analyze|look at|check|review|how is|what about|tell me about)\s+(.+?)(?:\?|$|\.)/i)
    if (clientMentionMatch) {
      const detail = await getClientDetail(clientMentionMatch[1].trim())
      if (detail) context += '\n' + detail
    }

    const member = await getUserOrgRole(user.id)

    const systemPrompt = `You are Pegasus, the AI operations assistant for this advertising agency. You have access to real-time performance data for all client ad accounts.

Your role:
- Analyze ad account performance and provide actionable insights
- Flag accounts that need attention with specific recommendations
- Compare performance across accounts and identify trends
- Suggest optimizations based on the data you see
- Be direct, data-driven, and action-oriented — no fluff
- Use specific numbers from the data when making points
- When asked about a specific client, provide detailed analysis

The user is ${member?.display_name || user.email} (${member?.role || 'member'}).

Current agency data:
${context}`

    // Call Gemini API
    const geminiMessages = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
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

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.'

    return new Response(JSON.stringify({ content: text }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    console.error('Pegasus chat error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
