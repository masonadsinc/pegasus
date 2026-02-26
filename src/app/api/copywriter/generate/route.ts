import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { logApiUsage } from '@/lib/api-usage'
import { getOrgId } from '@/lib/org'

const MODEL = 'gemini-3-flash-preview'

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').replace(/##\s?/g, '').replace(/`/g, '').replace(/###\s?/g, '')
}

export async function POST(req: NextRequest) {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const { clientId, days = 30, mode = 'variation' } = await req.json()
  if (!clientId) return new Response(JSON.stringify({ error: 'clientId required' }), { status: 400 })

  // Get client info
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, name, slug, business_description, target_audience, offer_service, brand_voice, kpi_goals, competitors, location, ai_notes')
    .eq('id', clientId)
    .single()

  if (!client) return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 })

  // Get brand assets
  const { data: brandAssets } = await supabaseAdmin
    .from('brand_assets')
    .select('brand_colors, style_guide, creative_prefs, hard_rules, visual_tone')
    .eq('client_id', clientId)
    .limit(1)
    .single()

  // Get active ad account
  const { data: accounts } = await supabaseAdmin
    .from('ad_accounts')
    .select('id, primary_action_type')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .limit(1)

  const account = accounts?.[0]
  if (!account) return new Response(JSON.stringify({ error: 'No active ad account' }), { status: 400 })

  // Get winning ads (top performers by CPR)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const { data: insights } = await supabaseAdmin
    .from('insights')
    .select('platform_ad_id, spend, impressions, clicks, leads, purchases, schedules')
    .eq('ad_account_id', account.id)
    .eq('level', 'ad')
    .gte('date', sinceStr)

  // Aggregate by ad
  const adMap = new Map<string, { spend: number; results: number; clicks: number; impressions: number }>()
  for (const row of (insights || [])) {
    const existing = adMap.get(row.platform_ad_id) || { spend: 0, results: 0, clicks: 0, impressions: 0 }
    existing.spend += row.spend || 0
    existing.results += (row.leads || 0) + (row.purchases || 0) + (row.schedules || 0)
    existing.clicks += row.clicks || 0
    existing.impressions += row.impressions || 0
    adMap.set(row.platform_ad_id, existing)
  }

  // Get ad details
  const adIds = Array.from(adMap.keys())
  const { data: adEntities } = await supabaseAdmin
    .from('ads')
    .select('platform_ad_id, name, creative_headline, creative_body, creative_cta, creative_url, creative_video_url, status')
    .eq('ad_account_id', account.id)
    .in('platform_ad_id', adIds.length > 0 ? adIds : ['__none__'])

  // Build top performers — ads with spend > 0, at least 1 result, ranked by lowest CPR
  const winners = (adEntities || [])
    .filter(ad => {
      const stats = adMap.get(ad.platform_ad_id)
      return stats && stats.spend > 0 && stats.results > 0
    })
    .map(ad => {
      const stats = adMap.get(ad.platform_ad_id)!
      return {
        name: ad.name,
        headline: ad.creative_headline,
        body: ad.creative_body,
        cta: ad.creative_cta,
        hasImage: !!ad.creative_url,
        hasVideo: !!ad.creative_video_url,
        status: ad.status,
        spend: stats.spend,
        results: stats.results,
        cpr: stats.spend / stats.results,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
      }
    })
    .sort((a, b) => a.cpr - b.cpr)
    .slice(0, 10)

  // Get campaign names for context
  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('platform_campaign_id, name, status')
    .eq('ad_account_id', account.id)

  const activeCampaigns = (campaigns || []).filter(c => c.status === 'ACTIVE').map(c => c.name).join(', ')

  // Get Gemini API key
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('gemini_api_key')
    .eq('id', ORG_ID)
    .single()

  const apiKey = org?.gemini_api_key || process.env.GEMINI_API_KEY
  if (!apiKey) return new Response(JSON.stringify({ error: 'Gemini API key not configured' }), { status: 500 })

  // Build the system prompt based on Cleo's framework
  const systemPrompt = buildSystemPrompt(client, brandAssets, winners, activeCampaigns, mode, account.primary_action_type)

  // Stream response via SSE
  const encoder = new TextEncoder()
  let fullOutput = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
              },
            }),
          }
        )

        if (!response.ok) {
          const err = await response.text()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Gemini API error: ${response.status}` })}\n\n`))
          controller.close()
          return
        }

        const reader = response.body?.getReader()
        if (!reader) { controller.close(); return }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (jsonStr === '[DONE]') continue

            try {
              const data = JSON.parse(jsonStr)
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                fullOutput += text
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
              }
            } catch {}
          }
        }

        // Save to DB
        const parsed = parseCopyBank(fullOutput)
        const { data: saved } = await supabaseAdmin
          .from('copy_banks')
          .insert({
            org_id: ORG_ID,
            client_id: clientId,
            period_days: days,
            messaging_foundation: parsed.messagingFoundation,
            angles: parsed.angles,
            image_ad_text: parsed.imageAdText,
            headlines: parsed.headlines,
            primary_text: parsed.primaryText,
            retargeting: parsed.retargeting,
            raw_output: fullOutput,
            status: 'draft',
            created_by: user.id,
          })
          .select('id')
          .single()

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, id: saved?.id })}\n\n`))

        // Log API usage
        await logApiUsage({
          model: MODEL,
          feature: 'creative-studio-analysis' as any,
          inputTokens: Math.round(systemPrompt.length / 4),
          outputTokens: Math.round(fullOutput.length / 4),
          metadata: { clientId, feature: 'copywriter', mode },
        })

      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`))
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

function buildSystemPrompt(
  client: any,
  brandAssets: any,
  winners: any[],
  activeCampaigns: string,
  mode: 'variation' | 'refresh',
  actionType: string
): string {
  const resultLabel = actionType === 'purchases' ? 'purchases' : actionType === 'schedule' ? 'scheduled appointments' : 'leads'

  let prompt = `You are Cleo, an elite direct response copywriter for Meta ads. You have studied Eugene Schwartz's Breakthrough Advertising, David Ogilvy, Russell Brunson, Robert Cialdini, and Donald Miller. You write copy that converts — not copy that impresses.

## YOUR CLIENT
Business: ${client.name}
${client.business_description ? `Description: ${client.business_description}` : ''}
${client.location ? `Location: ${client.location}` : ''}
${client.target_audience ? `Target Audience: ${client.target_audience}` : ''}
${client.offer_service ? `Core Offer/Service: ${client.offer_service}` : ''}
${client.brand_voice ? `Brand Voice: ${client.brand_voice}` : ''}
${client.kpi_goals ? `KPI Goals: ${client.kpi_goals}` : ''}
${client.competitors ? `Competitors: ${client.competitors}` : ''}
${client.ai_notes ? `Notes: ${client.ai_notes}` : ''}
Primary Metric: ${resultLabel}
Active Campaigns: ${activeCampaigns || 'None running'}
`

  if (brandAssets) {
    prompt += `\n## BRAND ASSETS\n`
    if (brandAssets.brand_colors?.length) {
      prompt += `Colors: ${brandAssets.brand_colors.map((c: any) => `${c.name || ''} ${c.hex}`).join(', ')}\n`
    }
    if (brandAssets.visual_tone) prompt += `Visual Tone: ${brandAssets.visual_tone}\n`
    if (brandAssets.style_guide) prompt += `Style Guide: ${brandAssets.style_guide}\n`
    if (brandAssets.creative_prefs) prompt += `Creative Preferences: ${brandAssets.creative_prefs}\n`
    if (brandAssets.hard_rules) prompt += `HARD RULES (must follow): ${brandAssets.hard_rules}\n`
  }

  if (winners.length > 0) {
    prompt += `\n## TOP PERFORMING ADS (last ${winners[0]?.spend ? 'period' : '30 days'}, ranked by lowest cost per ${resultLabel})\n`
    for (let i = 0; i < winners.length; i++) {
      const w = winners[i]
      prompt += `\n### Winner #${i + 1}: ${w.name}\n`
      prompt += `- CPR: $${w.cpr.toFixed(2)} | Spend: $${w.spend.toFixed(0)} | Results: ${w.results} | CTR: ${w.ctr.toFixed(2)}%\n`
      if (w.headline) prompt += `- Headline: "${w.headline}"\n`
      if (w.body) prompt += `- Primary Text: "${w.body.slice(0, 500)}${w.body.length > 500 ? '...' : ''}"\n`
      if (w.cta) prompt += `- CTA: ${w.cta}\n`
      prompt += `- Type: ${w.hasVideo ? 'Video' : 'Image'} | Status: ${w.status}\n`
    }
  }

  const modeInstructions = mode === 'variation'
    ? `MODE: VARIATION — Stay close to what's working. Analyze the winning ads above and iterate on them. Keep the same emotional angles, messaging patterns, and structural approaches that are driving results. Change the specific words, test new hooks, but DON'T depart from the proven formula.`
    : `MODE: REFRESH — The current creative is fatiguing. You need to find NEW angles, NEW emotional triggers, NEW hooks. Study the winners to understand the AUDIENCE (what they respond to), but deliberately take a different creative direction. New stories, new frames, new approaches.`

  prompt += `\n## MODE\n${modeInstructions}\n`

  prompt += `\n## YOUR TASK
Produce a complete COPY BANK for ${client.name}. Follow this EXACT structure:

### SECTION 1: MESSAGING FOUNDATION
Analyze the winning ads and the client info. Determine:
- Primary Mass Desire (one sentence — what the audience desperately wants)
- Awareness Stage (1-5, with explanation)
- Sophistication Stage (1-5, with explanation)
- Direct Callout (the exact opening line for every ad — must include location/audience)
- Stupid Simple Offer (one sentence, maximum)
- Key Proof Point
- #1 Objection and how to handle it

### SECTION 2: IMAGE AD TEXT (for design briefs)
For each of 3 angles, write 3 sets of:
- Headline (3-7 words, bold, unmissable)
- Sub-headline (5-12 words)
- CTA (2-4 words, action verb)
- Visual Concept (1-2 sentences describing the image scene — what the viewer sees behind the text. Be specific: environment, subject, lighting, mood, camera angle. NOT a description of the text — a description of the VISUAL.)
= 9 total image ad text sets

### SECTION 3: PRIMARY TEXT (feed copy)
For each of 3 angles:
- Strategy note (who, why this angle, what emotion)
- 5 headlines
- Short version (<125 words)
- Medium version (125-200 words)
- Long version (200-300 words)

Every version follows: Direct callout > Hook > Offer > Proof > CTA

### SECTION 4: RETARGETING COPY
- For website visitors (short, reminder-style)
- For video viewers (reference what they watched)
- For lead form abandoners (handle the objection)

## RULES
1. Every ad MUST start with a direct callout — who this is for
2. Offer in ONE sentence. If it takes two, simplify.
3. A 12-year-old must understand every ad
4. No corporate speak: no "leverage," "synergy," "solutions," "comprehensive"
5. No generic claims: no "best quality," "great service," "years of experience"
6. No weak CTAs: no "Learn more," "Click here"
7. Specificity sells — use numbers, locations, concrete outcomes
8. The first 2 lines are ALL they see before "...see more" — put the hook there
9. Ready to paste into Ads Manager — NO placeholders, NO [brackets]
10. Sound like the audience talking to a friend, not a corporation
11. No emojis in the copy
12. ${brandAssets?.hard_rules ? `CLIENT HARD RULES: ${brandAssets.hard_rules}` : 'No specific client restrictions'}

Write the complete copy bank now. Use clear section headers. Make every word earn its place.`

  return prompt
}

function parseCopyBank(raw: string): {
  messagingFoundation: any
  angles: any
  imageAdText: any
  headlines: any
  primaryText: any
  retargeting: any
} {
  // Parse sections from the raw output
  // This is best-effort — the raw text is always saved as fallback
  const sections: any = {}

  // Extract messaging foundation
  const mfMatch = raw.match(/MESSAGING FOUNDATION[\s\S]*?(?=##\s*SECTION 2|##\s*IMAGE AD TEXT|$)/i)
  if (mfMatch) {
    const mf = mfMatch[0]
    sections.messagingFoundation = {
      primaryDesire: extractField(mf, 'Primary Mass Desire'),
      awarenessStage: extractField(mf, 'Awareness Stage'),
      sophisticationStage: extractField(mf, 'Sophistication Stage'),
      directCallout: extractField(mf, 'Direct Callout'),
      offer: extractField(mf, 'Stupid Simple Offer'),
      proofPoint: extractField(mf, 'Key Proof Point'),
      objection: extractField(mf, 'Objection'),
    }
  }

  // Extract image ad text section
  const iatMatch = raw.match(/IMAGE AD TEXT[\s\S]*?(?=##\s*SECTION 3|##\s*PRIMARY TEXT|$)/i)
  sections.imageAdText = iatMatch ? iatMatch[0] : null

  // Extract primary text section
  const ptMatch = raw.match(/PRIMARY TEXT[\s\S]*?(?=##\s*SECTION 4|##\s*RETARGETING|$)/i)
  sections.primaryText = ptMatch ? ptMatch[0] : null

  // Extract retargeting section
  const rtMatch = raw.match(/RETARGETING[\s\S]*$/i)
  sections.retargeting = rtMatch ? rtMatch[0] : null

  return {
    messagingFoundation: sections.messagingFoundation || null,
    angles: null,
    imageAdText: sections.imageAdText || null,
    headlines: null,
    primaryText: sections.primaryText || null,
    retargeting: sections.retargeting || null,
  }
}

function extractField(text: string, field: string): string {
  const patterns = [
    new RegExp(`\\*?\\*?${field}\\*?\\*?[:\\s]*(.+?)(?:\\n|$)`, 'i'),
    new RegExp(`-\\s*\\*?\\*?${field}\\*?\\*?[:\\s]*(.+?)(?:\\n|$)`, 'i'),
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[1].trim().replace(/^\*\*|\*\*$/g, '').replace(/^"|"$/g, '')
  }
  return ''
}
