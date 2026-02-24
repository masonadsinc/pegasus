import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { isEcomActionType } from '@/lib/utils'
import { logApiUsage } from '@/lib/api-usage'

const ORG_ID = process.env.ADSINC_ORG_ID!
const META_TOKEN = process.env.META_ACCESS_TOKEN!
const META_VERSION = process.env.META_API_VERSION || 'v21.0'

async function getGeminiKey() {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('gemini_api_key')
    .eq('id', ORG_ID)
    .single()
  return data?.gemini_api_key || process.env.GEMINI_API_KEY || null
}

// Get video source URL from Meta API
async function getVideoSourceUrl(adPlatformId: string): Promise<{ videoUrl: string | null; videoId: string | null }> {
  try {
    // Step 1: Get creative details with video ID
    const adRes = await fetch(
      `https://graph.facebook.com/${META_VERSION}/${adPlatformId}?fields=creative{object_story_spec,asset_feed_spec}&access_token=${META_TOKEN}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!adRes.ok) return { videoUrl: null, videoId: null }
    const adData = await adRes.json()

    // Try to extract video_id
    let videoId: string | null = null
    const creative = adData.creative
    if (creative?.object_story_spec?.video_data?.video_id) {
      videoId = creative.object_story_spec.video_data.video_id
    } else if (creative?.asset_feed_spec?.videos?.[0]?.video_id) {
      videoId = creative.asset_feed_spec.videos[0].video_id
    }

    if (!videoId) return { videoUrl: null, videoId: null }

    // Step 2: Get video source URL
    const vidRes = await fetch(
      `https://graph.facebook.com/${META_VERSION}/${videoId}?fields=source&access_token=${META_TOKEN}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!vidRes.ok) return { videoUrl: null, videoId }
    const vidData = await vidRes.json()
    return { videoUrl: vidData.source || null, videoId }
  } catch {
    return { videoUrl: null, videoId: null }
  }
}

// Upload video to Gemini Files API (resumable upload)
async function uploadVideoToGemini(videoBuffer: ArrayBuffer, filename: string, apiKey: string): Promise<string | null> {
  try {
    // Step 1: Initiate resumable upload
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
    if (!uploadUrl) {
      console.error('No upload URL returned from Gemini')
      return null
    }

    // Step 2: Upload binary data
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
        'Content-Length': String(videoBuffer.byteLength),
      },
      body: videoBuffer,
    })

    if (!uploadRes.ok) {
      console.error('Video upload failed:', await uploadRes.text())
      return null
    }

    const result = await uploadRes.json()
    const fileUri = result.file?.uri
    const fileName = result.file?.name

    if (!fileUri || !fileName) return null

    // Step 3: Poll until processing is complete
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const statusRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
      )
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        if (statusData.state === 'ACTIVE') return fileUri
        if (statusData.state === 'FAILED') {
          console.error('Video processing failed')
          return null
        }
      }
    }
    return null
  } catch (e) {
    console.error('Video upload error:', e)
    return null
  }
}

// Delete file from Gemini after analysis
async function deleteGeminiFile(fileUri: string, apiKey: string) {
  try {
    const fileName = fileUri.split('/').slice(-2).join('/')
    await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`, { method: 'DELETE' })
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = await getGeminiKey()
    if (!apiKey) return NextResponse.json({ error: 'No Gemini API key configured' }, { status: 400 })

    const { clientId, days = 30 } = await req.json()
    if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

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

    // Date range (PST)
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

    const adIds = Object.keys(adPerf)
    if (adIds.length === 0) return NextResponse.json({ error: 'No ad data for this period' }, { status: 404 })

    // Get ad details
    const { data: adDetails } = await supabaseAdmin
      .from('ads')
      .select('platform_ad_id, name, creative_url, creative_video_url, creative_thumbnail_url, creative_headline, creative_body, creative_cta, created_time')
      .eq('ad_account_id', account.id)
      .in('platform_ad_id', adIds)

    // Merge and sort
    const adsWithCreatives = (adDetails || [])
      .filter(ad => ad.creative_url || ad.creative_video_url)
      .map(ad => {
        const perf = adPerf[ad.platform_ad_id] || { spend: 0, results: 0, clicks: 0, impressions: 0, revenue: 0 }
        const cpr = perf.results > 0 ? perf.spend / perf.results : Infinity
        const ctr = perf.impressions > 0 ? (perf.clicks / perf.impressions * 100) : 0
        const isVideo = !!(ad.creative_video_url && ad.creative_video_url.includes('/video'))
        const age = ad.created_time ? Math.floor((yesterday.getTime() - new Date(ad.created_time).getTime()) / 86400000) : null
        return {
          platformId: ad.platform_ad_id,
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

    // Filters: must have spend + results + live for 7+ days
    const qualified = adsWithCreatives.filter(a => a.results > 0 && a.spend > 0 && a.age !== null && a.age >= 7)

    // Split into videos and images, take top 3 of each by lowest CPR
    const topVideos = qualified.filter(a => a.isVideo).slice(0, 3)
    const topImages = qualified.filter(a => !a.isVideo).slice(0, 3)
    const allAdsForAnalysis = [...topVideos, ...topImages]

    if (allAdsForAnalysis.length === 0) {
      return NextResponse.json({ error: 'No qualifying ads found. Ads must have spend, at least 1 result, and be live for 7+ days.' }, { status: 404 })
    }

    const targetMetric = isEcom ? `Target ROAS: ${account.target_roas || 'not set'}x` : `Target CPL: $${account.target_cpl || 'not set'}`

    // Stream response
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        const send = (data: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        const geminiFiles: string[] = [] // Track for cleanup

        try {
          // Send ad metadata to UI first
          send({
            type: 'ads',
            ads: allAdsForAnalysis.map(a => ({
              name: a.name, imageUrl: a.imageUrl, videoUrl: a.videoUrl, thumbnailUrl: a.thumbnailUrl,
              isVideo: a.isVideo, spend: a.spend, results: a.results, cpr: a.cpr, ctr: a.ctr,
              headline: a.headline, age: a.age, isTop: true,
            })),
          })

          send({ type: 'status', message: 'Preparing creatives for analysis...' })

          // Build content parts for Gemini
          const contentParts: any[] = []
          const adContext: string[] = []

          for (let i = 0; i < allAdsForAnalysis.length; i++) {
            const ad = allAdsForAnalysis[i]
            const isVideo = allAdsForAnalysis[i].isVideo
            const label = isVideo ? 'TOP VIDEO' : 'TOP IMAGE'
            const cprStr = ad.results > 0 ? `$${ad.cpr.toFixed(2)}` : 'N/A (0 results)'

            adContext.push(`[Ad ${i + 1}] "${ad.name}" — ${label}
- Spend: $${ad.spend.toFixed(0)} | Results: ${ad.results} | CPR: ${cprStr} | CTR: ${ad.ctr.toFixed(2)}%
- Headline: "${ad.headline || 'N/A'}" | CTA: ${ad.cta || 'N/A'}
- Type: ${ad.isVideo ? 'VIDEO' : 'IMAGE'}${ad.age !== null ? ` | Age: ${ad.age} days` : ''}
${ad.body ? `- Body copy: "${ad.body.slice(0, 200)}"` : ''}`)

            // Handle video ads — try to get actual video
            if (ad.isVideo) {
              send({ type: 'status', message: `Downloading video for "${ad.name}"...` })

              const { videoUrl } = await getVideoSourceUrl(ad.platformId)
              let videoUploaded = false

              if (videoUrl) {
                try {
                  const vidRes = await fetch(videoUrl, { signal: AbortSignal.timeout(30000) })
                  if (vidRes.ok) {
                    const buffer = await vidRes.arrayBuffer()
                    if (buffer.byteLength > 10240) { // > 10KB
                      send({ type: 'status', message: `Uploading "${ad.name}" to Gemini (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB)...` })
                      const fileUri = await uploadVideoToGemini(buffer, `${ad.platformId}.mp4`, apiKey)
                      if (fileUri) {
                        geminiFiles.push(fileUri)
                        contentParts.push({
                          fileData: { mimeType: 'video/mp4', fileUri },
                        })
                        contentParts.push({
                          text: `[This is the FULL VIDEO for Ad ${i + 1}: "${ad.name}" — ${label}. Analyze the hook (first 3 seconds), pacing, scene transitions, and overall storytelling.]`,
                        })
                        videoUploaded = true
                      }
                    }
                  }
                } catch (e) {
                  console.error(`Video download failed for ${ad.name}:`, e)
                }
              }

              // Fallback to thumbnail if video failed
              if (!videoUploaded) {
                send({ type: 'status', message: `Video unavailable for "${ad.name}", using thumbnail...` })
                const thumbUrl = ad.imageUrl || ad.thumbnailUrl
                if (thumbUrl) {
                  try {
                    const imgRes = await fetch(thumbUrl, { signal: AbortSignal.timeout(8000) })
                    if (imgRes.ok) {
                      const buffer = await imgRes.arrayBuffer()
                      const base64 = Buffer.from(buffer).toString('base64')
                      contentParts.push({
                        inlineData: { mimeType: imgRes.headers.get('content-type') || 'image/jpeg', data: base64 },
                      })
                      contentParts.push({
                        text: `[This is a THUMBNAIL for Ad ${i + 1}: "${ad.name}" — ${label}. The actual video could not be downloaded. Analyze what's visible in this frame.]`,
                      })
                    }
                  } catch {}
                }
              }
            } else {
              // Image ad — inline base64
              const imageUrl = ad.imageUrl || ad.thumbnailUrl
              if (imageUrl) {
                try {
                  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) })
                  if (imgRes.ok) {
                    const buffer = await imgRes.arrayBuffer()
                    const base64 = Buffer.from(buffer).toString('base64')
                    contentParts.push({
                      inlineData: { mimeType: imgRes.headers.get('content-type') || 'image/jpeg', data: base64 },
                    })
                    contentParts.push({
                      text: `[This is the IMAGE for Ad ${i + 1}: "${ad.name}" — ${label}]`,
                    })
                  }
                } catch {}
              }
            }
          }

          send({ type: 'status', message: 'Running AI analysis...' })

          // System prompt — deep analysis
          const systemPrompt = `You are Pegasus, an elite Meta ads creative strategist analyzing ad creatives for ${client.name}. You can SEE the actual ad images and videos.

You have two types of creatives:
- **IMAGE ADS**: Analyze the static visual
- **VIDEO ADS**: If you received the full video, analyze the hook (first 3 seconds), pacing, scene transitions, audio cues, and storytelling arc. If only a thumbnail, note that and analyze the visible frame.

## Analysis Structure

For each creative, evaluate these 10 points:

**FOR IMAGE ADS:**
1. TEXT/COPY — All visible text on the image, readability, font choices
2. VISUAL ELEMENTS — Subject, background, objects, photography vs illustration
3. COLOR PALETTE — Dominant/accent colors, mood, contrast
4. LAYOUT & COMPOSITION — Text placement, hierarchy, whitespace, focal point
5. HOOK STRENGTH — Does it stop the scroll? What grabs attention?
6. MESSAGE CLARITY — Can you understand the offer in 2 seconds?
7. EMOTIONAL APPEAL — Trust, urgency, aspiration, fear, social proof
8. FORMAT FIT — Optimized for mobile feed? Stories? Square vs vertical?
9. STRENGTHS — What works well?
10. WEAKNESSES — What could improve?

**FOR VIDEO ADS:**
1. TRANSCRIPT — Key spoken words/text overlays
2. HOOK (first 3 seconds) — What grabs attention? How effective?
3. VISUAL BREAKDOWN — Key scenes, transitions, b-roll
4. MESSAGING — Core value props, persuasion tactics
5. CTA — What action are they driving? Clear and compelling?
6. PACING & EDITING — Energy level, cut frequency, music/sound
7. EMOTIONAL ARC — How does the viewer's emotion shift?
8. FORMAT FIT — Mobile-optimized? Works with sound off?
9. STRENGTHS
10. WEAKNESSES

## Output Format

INDIVIDUAL CREATIVE BREAKDOWN
[For each ad, give a 10-point analysis referencing it by name]

PATTERNS: WHAT'S WINNING
- Visual/creative patterns across top performers
- Be specific: "blue backgrounds with white sans-serif text" not "clean design"

PATTERNS: WHAT'S FAILING
- What the underperformers have in common vs the winners

CREATIVE RECOMMENDATIONS
- 5 specific new creative concepts based on winning patterns
- For each: describe the visual direction, headline angle, format (static/video/carousel), and WHY it should work based on data

QUICK WINS
- Simple edits to existing ads that could improve performance

Rules:
- Reference ads by name
- Be extremely specific about visual elements
- ${targetMetric}
- No emojis, no fluff
- ${isEcom ? 'Focus on purchase-driving elements' : 'Focus on lead-gen elements — what makes someone fill out a form'}
- If analyzing a video, comment on the hook effectiveness and whether the story structure leads to action`

          // Call Gemini with streaming
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts: [
                    { text: `Analyze these ${allAdsForAnalysis.length} ad creatives for ${client.name}.\n\nPerformance data:\n${adContext.join('\n\n')}\n\nThe creative assets (images and videos) follow. Give a deep 10-point analysis of each creative, then identify patterns and give recommendations.` },
                    ...contentParts,
                  ],
                }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
              }),
            }
          )

          let fullAnalysis = ''

          if (!response.ok) {
            const err = await response.text()
            console.error('Gemini creative analysis error:', err)
            send({ type: 'error', message: 'AI analysis failed' })
          } else {
            const reader = response.body!.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

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
                      fullAnalysis += text
                      send({ type: 'text', text })
                    }
                  } catch {}
                }
              }
            }
          }

          // Cleanup Gemini files
          for (const uri of geminiFiles) {
            await deleteGeminiFile(uri, apiKey)
          }

          // Save analysis to DB
          // Log approximate usage (streaming doesn't return token counts)
          const approxInputTokens = Math.round(JSON.stringify(allAdsForAnalysis).length / 4)
          const approxOutputTokens = Math.round(fullAnalysis.length / 4)
          logApiUsage({ model: 'gemini-3-flash-preview', feature: 'creative-analysis', inputTokens: approxInputTokens, outputTokens: approxOutputTokens })

          if (fullAnalysis) {
            await supabaseAdmin.from('creative_analyses').insert({
              org_id: ORG_ID,
              client_id: clientId,
              period_days: days,
              ads_analyzed: allAdsForAnalysis.map(a => ({
                name: a.name, isVideo: a.isVideo, spend: a.spend, results: a.results,
                cpr: a.cpr, ctr: a.ctr, age: a.age, headline: a.headline,
                imageUrl: a.imageUrl, thumbnailUrl: a.thumbnailUrl,
              })),
              analysis_text: fullAnalysis,
              created_by: user.id,
            })
          }

          send({ type: 'done' })
        } catch (e: any) {
          console.error('Creative analysis error:', e)
          send({ type: 'error', message: e.message || 'Analysis failed' })
        }

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
