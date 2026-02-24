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
  return data?.gemini_api_key || process.env.GEMINI_API_KEY || null
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = await getGeminiKey()
    if (!apiKey) return NextResponse.json({ error: 'No Gemini API key configured' }, { status: 400 })

    const { clientId, days = 30 } = await req.json()
    if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

    // Get client + account
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('*, ad_accounts(*)')
      .eq('org_id', ORG_ID)
      .eq('id', clientId)
      .single()

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    const account = (client.ad_accounts as any[])?.find((a: any) => a.is_active)
    if (!account) return NextResponse.json({ error: 'No active ad account' }, { status: 404 })

    const isEcom = isEcomActionType(account.primary_action_type)

    // Date range
    const now = new Date()
    const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const yesterday = new Date(pst); yesterday.setDate(pst.getDate() - 1)
    const start = new Date(yesterday); start.setDate(yesterday.getDate() - (days - 1))
    const yStr = yesterday.toISOString().split('T')[0]
    const dStr = start.toISOString().split('T')[0]

    // Get ad-level insights
    const { data: adInsights } = await supabaseAdmin
      .from('insights')
      .select('platform_ad_id, spend, impressions, clicks, leads, purchases, schedules, purchase_value')
      .eq('ad_account_id', account.id)
      .eq('level', 'ad')
      .gte('date', dStr)
      .lte('date', yStr)
      .limit(3000)

    // Aggregate by ad
    const adPerf: Record<string, { spend: number; results: number; clicks: number; impressions: number; revenue: number }> = {}
    for (const row of (adInsights || [])) {
      const id = row.platform_ad_id
      if (!adPerf[id]) adPerf[id] = { spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
      adPerf[id].spend += row.spend || 0
      adPerf[id].results += (row.leads || 0) + (row.purchases || 0) + (row.schedules || 0)
      adPerf[id].clicks += row.clicks || 0
      adPerf[id].impressions += row.impressions || 0
      adPerf[id].revenue += row.purchase_value || 0
    }

    // Get ad details with creatives
    const adIds = Object.keys(adPerf)
    if (adIds.length === 0) return NextResponse.json({ error: 'No ad data for this period' }, { status: 404 })

    const { data: adDetails } = await supabaseAdmin
      .from('ads')
      .select('platform_ad_id, name, creative_url, creative_video_url, creative_thumbnail_url, creative_headline, creative_body, creative_cta, created_time')
      .eq('ad_account_id', account.id)
      .in('platform_ad_id', adIds)

    // Merge performance + creative data
    const adsWithCreatives = (adDetails || [])
      .filter(ad => ad.creative_url || ad.creative_video_url)
      .map(ad => {
        const perf = adPerf[ad.platform_ad_id] || { spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
        const cpr = perf.results > 0 ? perf.spend / perf.results : Infinity
        const ctr = perf.impressions > 0 ? (perf.clicks / perf.impressions * 100) : 0
        const isVideo = !!ad.creative_video_url
        const age = ad.created_time ? Math.floor((yesterday.getTime() - new Date(ad.created_time).getTime()) / 86400000) : null
        return {
          id: ad.platform_ad_id,
          name: ad.name,
          imageUrl: ad.creative_url,
          videoUrl: ad.creative_video_url,
          thumbnailUrl: ad.creative_thumbnail_url,
          headline: ad.creative_headline,
          body: ad.creative_body,
          cta: ad.creative_cta,
          isVideo,
          age,
          ...perf,
          cpr,
          ctr,
        }
      })
      .filter(ad => ad.spend > 0)
      .sort((a, b) => a.cpr - b.cpr)

    // Split into top performers and worst performers
    const withResults = adsWithCreatives.filter(a => a.results > 0)
    const withoutResults = adsWithCreatives.filter(a => a.results === 0 && a.spend > 20).sort((a, b) => b.spend - a.spend)

    const topAds = withResults.slice(0, 8)
    const worstAds = withoutResults.slice(0, 5)
    const allAdsForAnalysis = [...topAds, ...worstAds]

    if (allAdsForAnalysis.length === 0) {
      return NextResponse.json({ error: 'No ads with creative assets found' }, { status: 404 })
    }

    // Build Gemini request with images
    // Gemini can handle image URLs directly via inlineData or fileData
    // For images, we'll use the image URLs; for videos, we'll use thumbnail + note it's a video
    const imageParts: any[] = []
    const adContext: string[] = []

    for (let i = 0; i < allAdsForAnalysis.length; i++) {
      const ad = allAdsForAnalysis[i]
      const isTop = i < topAds.length
      const label = isTop ? 'TOP PERFORMER' : 'UNDERPERFORMER'
      const cprStr = ad.results > 0 ? `$${ad.cpr.toFixed(2)}` : 'N/A (0 results)'

      adContext.push(`[Ad ${i + 1}] "${ad.name}" — ${label}
- Spend: $${ad.spend.toFixed(0)} | Results: ${ad.results} | CPR: ${cprStr} | CTR: ${ad.ctr.toFixed(2)}%
- Headline: "${ad.headline || 'N/A'}" | CTA: ${ad.cta || 'N/A'}
- Type: ${ad.isVideo ? 'VIDEO' : 'IMAGE'}${ad.age !== null ? ` | Age: ${ad.age} days` : ''}
${ad.body ? `- Body copy: "${ad.body.slice(0, 200)}"` : ''}`)

      // Add image URL for Gemini to analyze
      const imageUrl = ad.imageUrl || ad.thumbnailUrl
      if (imageUrl) {
        // Fetch image and convert to base64 for Gemini inline_data
        try {
          const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) })
          if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer()
            const base64 = Buffer.from(buffer).toString('base64')
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
            imageParts.push({
              inlineData: { mimeType: contentType, data: base64 },
            })
            imageParts.push({
              text: `[This is the creative for Ad ${i + 1}: "${ad.name}" — ${label}]`,
            })
          }
        } catch {
          // Skip if image fetch fails
        }
      }
    }

    const targetMetric = isEcom ? `Target ROAS: ${account.target_roas || 'not set'}x` : `Target CPL: $${account.target_cpl || 'not set'}`

    const systemPrompt = `You are Pegasus, an expert Meta ads creative strategist analyzing ad creatives for ${client.name}. You can SEE the actual ad images/thumbnails.

Your job is to analyze WHAT is working visually and WHAT is not, then give specific creative recommendations.

For each creative, analyze:
1. **Visual composition** — layout, colors, contrast, focal point, text overlay readability
2. **Hook strength** — does it stop the scroll? What makes it compelling (or not)?
3. **Message clarity** — can you understand the offer in 2 seconds?
4. **Format fit** — is it optimized for mobile feed/stories/reels?
5. **Brand consistency** — do the creatives feel cohesive?

Structure your response:

WHAT'S WINNING
- Analyze the top performers: what visual elements, angles, formats are driving results?
- Be specific about colors, imagery style, text placement, emotional triggers

WHAT'S FAILING
- Analyze the underperformers: why aren't they converting?
- Compare them to the winners — what's different?

CREATIVE RECOMMENDATIONS
- Give 3-5 specific new creative concepts to test, based on patterns in the winning ads
- For each concept, describe: visual direction, headline angle, format (static/video/carousel), and why it should work

QUICK WINS
- Simple changes to existing ads that could improve performance (e.g., "Ad 3's headline is too small — increase font size and add contrast")

Rules:
- Reference ads by name and number
- Be specific about visual elements — "the blue background with white text" not "nice design"
- ${targetMetric}
- No emojis, no fluff
- ${isEcom ? 'Focus on purchase-driving creative elements' : 'Focus on lead-gen creative — what makes someone fill out a form'}`

    const contents = [
      {
        role: 'user',
        parts: [
          { text: `Analyze these ${allAdsForAnalysis.length} ad creatives for ${client.name}. Here's the performance data:\n\n${adContext.join('\n\n')}\n\nThe images follow. Analyze each one visually and connect the visual elements to the performance data above.` },
          ...imageParts,
        ],
      },
    ]

    // Call Gemini with streaming
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('Gemini creative analysis error:', err)
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 502 })
    }

    // Stream SSE back to client
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        // First send the ads data so the UI can render them
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ads', ads: allAdsForAnalysis.map(a => ({ name: a.name, imageUrl: a.imageUrl, videoUrl: a.videoUrl, thumbnailUrl: a.thumbnailUrl, isVideo: a.isVideo, spend: a.spend, results: a.results, cpr: a.cpr, ctr: a.ctr, headline: a.headline, age: a.age, isTop: withResults.includes(a) })) })}\n\n`))

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6).trim()
                if (jsonStr === '[DONE]') continue
                try {
                  const parsed = JSON.parse(jsonStr)
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
                  if (text) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`))
                  }
                } catch {}
              }
            }
          }
        } catch (e) {
          console.error('Stream error:', e)
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        controller.close()
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e: any) {
    console.error('Creative analysis error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
