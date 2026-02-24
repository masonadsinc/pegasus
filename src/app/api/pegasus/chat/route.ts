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
  const stored = data?.gemini_api_key
  if (!stored) return process.env.GEMINI_API_KEY || null
  return stored || process.env.GEMINI_API_KEY || null
}

async function getClientContext(clientId: string, days = 7) {
  // Get client with all AI context fields
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*, ad_accounts(*)')
    .eq('org_id', ORG_ID)
    .eq('id', clientId)
    .single()

  if (!client) return null

  const account = (client.ad_accounts as any[])?.find((a: any) => a.is_active)
  if (!account) return { client, context: `${client.name}: No active ad account.` }

  // Date math in PST
  const now = new Date()
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const yesterday = new Date(pst); yesterday.setDate(pst.getDate() - 1)
  const daysAgo = new Date(pst); daysAgo.setDate(pst.getDate() - days)
  const prevStart = new Date(pst); prevStart.setDate(pst.getDate() - days * 2)
  const yStr = yesterday.toISOString().split('T')[0]
  const dStr = daysAgo.toISOString().split('T')[0]
  const pStr = prevStart.toISOString().split('T')[0]

  // Get insights for this account only
  const { data: insights } = await supabaseAdmin
    .from('insights')
    .select('date, spend, impressions, clicks, leads, purchases, purchase_value, schedules, landing_page_views')
    .eq('ad_account_id', account.id)
    .eq('level', 'account')
    .gte('date', pStr)
    .lte('date', yStr)
    .order('date', { ascending: true })
    .limit(500)

  // Get active ads for this account
  const { data: activeAds } = await supabaseAdmin
    .from('ads')
    .select('name, creative_headline, creative_body, creative_cta, effective_status')
    .eq('ad_account_id', account.id)
    .eq('effective_status', 'ACTIVE')
    .limit(20)

  // Get campaign-level data
  const { data: campaignInsights } = await supabaseAdmin
    .from('insights')
    .select('campaign_name, spend, impressions, clicks, leads, purchases, purchase_value, schedules')
    .eq('ad_account_id', account.id)
    .eq('level', 'campaign')
    .gte('date', dStr)
    .lte('date', yStr)
    .limit(500)

  const isEcom = isEcomActionType(account.primary_action_type)
  const thisWeek = (insights || []).filter(i => i.date > dStr && i.date <= yStr)
  const lastWeek = (insights || []).filter(i => i.date >= pStr && i.date <= dStr)

  const tw = thisWeek.reduce((s, i) => ({
    spend: s.spend + (i.spend || 0), impressions: s.impressions + (i.impressions || 0),
    clicks: s.clicks + (i.clicks || 0), results: s.results + (i.leads || 0) + (i.purchases || 0) + (i.schedules || 0),
    purchase_value: s.purchase_value + (i.purchase_value || 0), lpv: s.lpv + (i.landing_page_views || 0),
  }), { spend: 0, impressions: 0, clicks: 0, results: 0, purchase_value: 0, lpv: 0 })

  const lw = lastWeek.reduce((s, i) => ({
    spend: s.spend + (i.spend || 0), results: s.results + (i.leads || 0) + (i.purchases || 0) + (i.schedules || 0),
    purchase_value: s.purchase_value + (i.purchase_value || 0),
  }), { spend: 0, results: 0, purchase_value: 0 })

  const cpr = tw.results > 0 ? tw.spend / tw.results : 0
  const lwCpr = lw.results > 0 ? lw.spend / lw.results : 0
  const ctr = tw.impressions > 0 ? (tw.clicks / tw.impressions) * 100 : 0
  const cpc = tw.clicks > 0 ? tw.spend / tw.clicks : 0
  const convRate = tw.clicks > 0 ? (tw.results / tw.clicks) * 100 : 0
  const roas = tw.spend > 0 ? tw.purchase_value / tw.spend : 0

  // Build context string — focused, efficient
  let ctx = `# ${client.name}\n`
  ctx += `Data period: ${dStr} to ${yStr} (${days} days)\n\n`

  // Client profile
  ctx += `## Client Profile\n`
  ctx += `- Industry: ${client.industry || 'N/A'} | Location: ${client.location || 'N/A'}\n`
  ctx += `- Status: ${client.status} | Retainer: $${client.monthly_retainer || 0}/mo\n`
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

  // Performance
  ctx += `## This Week Performance\n`
  ctx += `- Spend: $${tw.spend.toFixed(2)} | Results: ${tw.results} | CPR: $${cpr.toFixed(2)}\n`
  ctx += `- Impressions: ${tw.impressions.toLocaleString()} | Clicks: ${tw.clicks.toLocaleString()}\n`
  ctx += `- CTR: ${ctr.toFixed(2)}% | CPC: $${cpc.toFixed(2)} | Conv Rate: ${convRate.toFixed(2)}%\n`
  if (isEcom) ctx += `- Revenue: $${tw.purchase_value.toFixed(2)} | ROAS: ${roas.toFixed(2)}x\n`
  if (tw.lpv > 0) ctx += `- Landing page views: ${tw.lpv}\n`
  ctx += '\n'

  // WoW comparison
  ctx += `## Last Week Comparison\n`
  ctx += `- Last week spend: $${lw.spend.toFixed(2)} | Results: ${lw.results} | CPR: $${lwCpr.toFixed(2)}\n`
  if (lw.spend > 0) ctx += `- Spend change: ${((tw.spend - lw.spend) / lw.spend * 100).toFixed(1)}%\n`
  if (lwCpr > 0 && cpr > 0) ctx += `- CPR change: ${((cpr - lwCpr) / lwCpr * 100).toFixed(1)}%\n`
  ctx += '\n'

  // Daily breakdown
  ctx += `## Daily Breakdown (last ${days} days)\n`
  for (const day of thisWeek) {
    const dr = (day.leads || 0) + (day.purchases || 0) + (day.schedules || 0)
    const dcpr = dr > 0 ? (day.spend || 0) / dr : 0
    ctx += `- ${day.date}: $${(day.spend || 0).toFixed(0)} spend, ${dr} results, $${dcpr.toFixed(2)} CPR\n`
  }
  ctx += '\n'

  // Campaign breakdown
  if (campaignInsights?.length) {
    const campaigns: Record<string, any> = {}
    for (const ci of campaignInsights) {
      const name = ci.campaign_name || 'Unknown'
      if (!campaigns[name]) campaigns[name] = { spend: 0, results: 0, impressions: 0, clicks: 0 }
      campaigns[name].spend += ci.spend || 0
      campaigns[name].results += (ci.leads || 0) + (ci.purchases || 0) + (ci.schedules || 0)
      campaigns[name].impressions += ci.impressions || 0
      campaigns[name].clicks += ci.clicks || 0
    }
    ctx += `## Campaign Breakdown\n`
    const sorted = Object.entries(campaigns).sort((a, b) => b[1].spend - a[1].spend)
    for (const [name, d] of sorted.slice(0, 10)) {
      const ccpr = d.results > 0 ? d.spend / d.results : 0
      ctx += `- ${name}: $${d.spend.toFixed(0)} spend, ${d.results} results, $${ccpr.toFixed(2)} CPR\n`
    }
    ctx += '\n'
  }

  // Active ads
  if (activeAds?.length) {
    ctx += `## Active Ads (${activeAds.length})\n`
    for (const ad of activeAds.slice(0, 10)) {
      ctx += `- "${ad.name}" | Headline: "${ad.creative_headline || 'N/A'}" | CTA: ${ad.creative_cta || 'N/A'}\n`
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

    const { messages, clientId } = await req.json()
    if (!messages?.length) return new Response(JSON.stringify({ error: 'No messages' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    if (!clientId) return new Response(JSON.stringify({ error: 'No client selected' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

    const result = await getClientContext(clientId)
    if (!result) return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })

    const member = await getUserOrgRole(user.id)

    const systemPrompt = `You are Pegasus, the AI operations assistant for a Meta advertising agency. You are currently analyzing one specific client account.

Your role:
- Provide deep, actionable analysis on this client's ad performance
- Flag issues with specific, numbered recommendations
- Use exact numbers from the data — never approximate when you have the real figure
- Compare current vs previous period to identify trends
- Consider the client's business context, audience, and goals in your analysis
- Be direct and action-oriented. No fluff, no caveats, no filler.
- When suggesting optimizations, be specific (which campaign, what to change, expected impact)

The user is ${member?.display_name || user.email} (${member?.role || 'member'}).

${result.context}`

    // Gemini 2.5 Pro with streaming
    const geminiMessages = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-06-05:streamGenerateContent?alt=sse&key=${apiKey}`,
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

    // Stream the response back as SSE
    const readable = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          controller.close()
          return
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (!data) continue
                try {
                  const parsed = JSON.parse(data)
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
                  if (text) {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`))
                  }
                } catch {}
              }
            }
          }
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        } catch (e) {
          console.error('Stream error:', e)
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (e: any) {
    console.error('Pegasus chat error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
