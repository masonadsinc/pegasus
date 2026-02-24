import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

async function getGeminiKey(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('gemini_api_key')
    .eq('id', ORG_ID)
    .single()
  return data?.gemini_api_key || process.env.GEMINI_API_KEY || null
}

// Fetch image as base64
async function fetchImageBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    return {
      data: Buffer.from(buffer).toString('base64'),
      mimeType: res.headers.get('content-type') || 'image/jpeg',
    }
  } catch {
    return null
  }
}

// Step 1: Analyze the winning ad with Gemini Flash (vision)
async function analyzeWinner(apiKey: string, imageBase64: string, imageMime: string, adName: string, stats: { spend: number; results: number; cpr: number; ctr: number }): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: imageMime, data: imageBase64 } },
            { text: `This is a top-performing Meta ad image called "${adName}". Performance: $${stats.spend.toFixed(0)} spend, ${stats.results} results, $${stats.cpr.toFixed(2)} CPR, ${stats.ctr.toFixed(2)}% CTR.

Analyze this ad image in detail. For each point, be SPECIFIC about what you see:

1. CONTAINS PEOPLE — Yes or No. If yes, describe (faces visible? just hands/torso?)
2. VISUAL CONCEPT — Describe the scene, imagery, composition, style type (photorealistic, graphic, typographic, etc.)
3. COLOR PALETTE — List the dominant colors with approximate hex codes. Note contrast and color hierarchy.
4. HEADLINE & COPY — Transcribe ALL text exactly as it appears. Note the messaging angle.
5. EMOTIONAL TRIGGER — What feeling does this ad create? Why would someone stop scrolling?
6. LAYOUT — Describe the spatial arrangement: where is the headline, visual, CTA, supporting text? What percentage of space does each occupy?
7. WHAT'S WORKING — Based on performance data and visual analysis, why does this ad convert?
8. WHAT COULD BE IMPROVED — Specific opportunities for the variation.

Be detailed and specific. This analysis drives the next creative generation.` }
          ]
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Winner analysis failed: ${response.status} - ${err}`)
  }

  const result = await response.json()
  return result.candidates?.[0]?.content?.parts?.[0]?.text || 'Analysis unavailable'
}

// Step 2: QA check on generated image
async function qaCheck(apiKey: string, imageBase64: string, imageMime: string): Promise<{ pass: boolean; issues: string[] }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: imageMime, data: imageBase64 } },
            { text: `You are a QA checker for AI-generated ad creatives. Check this image for FAILURES:

1. GIBBERISH TEXT — Any garbled, misspelled, or nonsensical text? (Look carefully at every word)
2. PLACEHOLDER LABELS — Does it say "Headline", "Title", "Sub-headline", "CTA", "Logo" etc.?
3. UNREADABLE TEXT — Any text too small, blurry, or obscured to read on a phone?
4. CLUTTERED LAYOUT — More than 5-6 elements competing for attention?
5. WRONG CTA PLACEMENT — Is the CTA missing or not in the bottom portion?
6. SCREEN TEXT — Any laptop/phone screens showing illegible text?
7. DISTORTED ELEMENTS — Any warped faces, hands, objects that look obviously AI-generated?

Respond in this exact format:
PASS: true OR PASS: false
ISSUES: [comma-separated list of issues found, or "none"]` }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
    }
  )

  if (!response.ok) return { pass: true, issues: [] } // Don't block on QA failure

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const pass = text.includes('PASS: true')
  const issueMatch = text.match(/ISSUES:\s*(.+)/i)
  const issues = issueMatch ? issueMatch[1].split(',').map((s: string) => s.trim()).filter((s: string) => s && s !== 'none') : []

  return { pass, issues }
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = await getGeminiKey()
  if (!apiKey) return NextResponse.json({ error: 'No Gemini API key configured' }, { status: 400 })

  const {
    clientId,
    winnerImageUrl,
    winnerName = 'Unknown Ad',
    winnerStats = {},
    aspectRatio = '1:1',
    resolution = '4K',
    additionalDirection = '',
    mode = 'variation', // variation | refresh | manual
    manualPrompt = '',
    referenceImageUrls = [],
    concept = '',
  } = await req.json()

  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Use SSE for progress updates
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Load brand assets
        send({ type: 'status', message: 'Loading brand assets...' })
        const { data: brandAssets } = await supabaseAdmin
          .from('brand_assets')
          .select('*')
          .eq('org_id', ORG_ID)
          .eq('client_id', clientId)
          .single()

        // Load client info
        const { data: client } = await supabaseAdmin
          .from('clients')
          .select('name, brand_voice, ai_notes')
          .eq('id', clientId)
          .single()

        // Load creative history (last 30 days) for anti-repetition
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const { data: recentCreatives } = await supabaseAdmin
          .from('generated_creatives')
          .select('concept, metadata')
          .eq('client_id', clientId)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(20)

        const historyList = (recentCreatives || [])
          .map(c => c.concept || c.metadata?.conceptSummary || '')
          .filter(Boolean)

        // Fetch and analyze the winner image
        let winnerAnalysis = ''
        let winnerImageData: { data: string; mimeType: string } | null = null

        if (winnerImageUrl && mode !== 'manual') {
          send({ type: 'status', message: 'Downloading winning ad...' })
          winnerImageData = await fetchImageBase64(winnerImageUrl)

          if (winnerImageData) {
            send({ type: 'status', message: 'Analyzing what makes this ad work...' })
            winnerAnalysis = await analyzeWinner(
              apiKey,
              winnerImageData.data,
              winnerImageData.mimeType,
              winnerName,
              { spend: winnerStats.spend || 0, results: winnerStats.results || 0, cpr: winnerStats.cpr || 0, ctr: winnerStats.ctr || 0 }
            )
            send({ type: 'analysis', text: winnerAnalysis })
          }
        }

        // Fetch additional reference images
        const refImages: { data: string; mimeType: string }[] = []
        for (const url of referenceImageUrls.slice(0, 5)) {
          const img = await fetchImageBase64(url)
          if (img) refImages.push(img)
        }

        // Build the generation prompt
        send({ type: 'status', message: 'Building creative brief...' })
        let fullPrompt = ''

        if (mode === 'manual' && manualPrompt) {
          fullPrompt = manualPrompt
        } else {
          // === LAYER 1: Winner analysis ===
          if (winnerAnalysis) {
            fullPrompt += `WINNING AD ANALYSIS (this is what's already working — match this energy):\n${winnerAnalysis}\n\n`
          }

          // === LAYER 2: Brand colors ===
          if (brandAssets?.brand_colors?.length > 0) {
            fullPrompt += `EXACT COLORS TO USE (official brand colors):\n`
            for (const color of brandAssets.brand_colors) {
              fullPrompt += `- ${color.name || color.label || 'Color'}: ${color.hex || color.value || color}\n`
            }
            fullPrompt += `YOU MUST USE THESE EXACT HEX CODES. Do not approximate or substitute colors.\n\n`
          }

          // === LAYER 3: Style guide ===
          if (brandAssets?.style_guide) {
            fullPrompt += `BRAND STYLE GUIDE:\n${brandAssets.style_guide}\n\n`
          }

          // === LAYER 4: Creative preferences ===
          if (brandAssets?.creative_prefs) {
            fullPrompt += `CREATIVE DIRECTION (FOLLOW THESE RULES CLOSELY):\n${brandAssets.creative_prefs}\n\n`
          }
          if (client?.brand_voice) {
            fullPrompt += `BRAND VOICE: ${client.brand_voice}\n\n`
          }

          // === LAYER 5: Creative history (anti-repetition) ===
          if (historyList.length > 0) {
            fullPrompt += `CREATIVE HISTORY (what's been generated in the last 30 days — AVOID repeating):\n`
            for (const h of historyList) {
              fullPrompt += `- ${h}\n`
            }
            fullPrompt += `Create something FRESH and different from these. Explore new visual territories.\n\n`
          }

          // === LAYER 6: Generation instructions ===
          if (mode === 'refresh') {
            fullPrompt += `MODE: REFRESH — The audience is FATIGUED on the current creative.
DON'T just tweak the old concept. The audience needs something that feels NEW:
- Different visual approach entirely
- Different headline angle
- Different emphasis
- If the old ad was calm, try bold. If it was busy, try minimal.
CONTRAST is key. The goal is to stop the scroll again for people who've seen the current ads too many times.\n\n`
          } else {
            fullPrompt += `MODE: VARIATION — Create a sibling creative that lives in the same visual family.

MATCH THE WINNER'S STYLE — CREATE A VARIATION, NOT A COPY, NOT A COMPLETE DEPARTURE:
- KEEP the same visual style and energy
- KEEP the same general layout approach and color feel
- CHANGE the headline — same value prop, different angle or wording
- CHANGE the visual subject — same style but different scene/composition
- CHANGE the CTA text — same intent, different words

Think of it as: "What would a designer create if you said 'give me 3 more like this one but each slightly different'?"\n\n`
          }

          // === Layout specification ===
          fullPrompt += `LAYOUT — follow this EXACTLY:
1. TOP 20%: Real headline text — bold, clean, sans-serif. 3-7 words.
2. BELOW HEADLINE: One line of supporting text. 5-12 words.
3. MIDDLE 50-60%: Full-bleed visual that MATCHES the winner's style.
4. BOTTOM 15%: CTA button — pill/rounded rectangle, brand accent color, 2-4 words.

HARD RULES:
- ${aspectRatio} aspect ratio, ${resolution} resolution
- All text must be large, bold, and readable at phone size
- Full-bleed background — no white boxes, no clip art, no floating elements
- Professional, photorealistic quality
- ABSOLUTELY NO LOGOS — no company logos, brand marks, watermarks
- NO placeholder labels — every piece of text must be real ad copy
- NO gibberish text — every word must be spelled correctly
- NO laptop/phone screens with text on them\n\n`

          // === Hard rules from brand assets ===
          if (brandAssets?.hard_rules) {
            fullPrompt += `ADDITIONAL BRAND RULES:\n${brandAssets.hard_rules}\n\n`
          }

          // === Additional user direction ===
          if (additionalDirection) {
            fullPrompt += `SPECIFIC DIRECTION FROM USER:\n${additionalDirection}\n\n`
          }
        }

        // Build the API contents — winner/references FIRST (style anchor), then prompt
        send({ type: 'status', message: 'Generating creative...' })
        const contents: any[] = []

        // Winner image first (strongest style influence)
        if (winnerImageData) {
          contents.push({ inlineData: { mimeType: winnerImageData.mimeType, data: winnerImageData.data } })
          contents.push({ text: 'Above is the reference/winning ad. Study its visual style, color palette, layout, typography, and overall aesthetic. The new creative should feel like it belongs in the same campaign.' })
        }

        // Additional references
        for (const ref of refImages) {
          contents.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } })
        }
        if (refImages.length > 0) {
          contents.push({ text: `Above are ${refImages.length} additional style reference(s). Match their visual language.` })
        }

        // The full prompt
        contents.push({ text: fullPrompt })

        // Call Nano Banana Pro
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: contents }],
              generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
                temperature: 1.0,
              },
            }),
          }
        )

        if (!response.ok) {
          const errText = await response.text()
          console.error('Gemini generation error:', errText)
          send({ type: 'error', message: `Generation failed: ${response.status}` })
          controller.close()
          return
        }

        const result = await response.json()
        const parts = result.candidates?.[0]?.content?.parts || []

        let imageData: string | null = null
        let imageMime = 'image/png'
        let modelNotes = ''

        for (const part of parts) {
          if (part.inlineData) {
            imageData = part.inlineData.data
            imageMime = part.inlineData.mimeType || 'image/png'
          }
          if (part.text) modelNotes += part.text
        }

        if (!imageData) {
          send({ type: 'error', message: 'No image generated. The model may have refused the prompt.' })
          controller.close()
          return
        }

        // QA check
        send({ type: 'status', message: 'Running quality check...' })
        const qa = await qaCheck(apiKey, imageData, imageMime)

        if (!qa.pass) {
          send({ type: 'qa_warning', issues: qa.issues })

          // Retry once with tighter constraints
          send({ type: 'status', message: 'QA issues detected — retrying with tighter constraints...' })
          const retryParts = [...contents]
          retryParts.push({ text: '\n\nIMPORTANT RETRY: The previous generation had quality issues. This time:\n- Keep the design VERY SIMPLE\n- Every single word must be spelled correctly\n- NO placeholder text like "Headline" or "CTA"\n- Text must be LARGE and READABLE\n- Maximum 4-5 elements total' })

          const retryResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: retryParts }],
                generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 0.8 },
              }),
            }
          )

          if (retryResponse.ok) {
            const retryResult = await retryResponse.json()
            const retryPartsResult = retryResult.candidates?.[0]?.content?.parts || []
            for (const part of retryPartsResult) {
              if (part.inlineData) {
                imageData = part.inlineData.data
                imageMime = part.inlineData.mimeType || 'image/png'
              }
              if (part.text) modelNotes = part.text
            }
          }
        }

        // Get concept summary for history tracking
        send({ type: 'status', message: 'Saving creative...' })
        let conceptSummary = concept
        if (!conceptSummary && imageData) {
          try {
            const summaryRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    role: 'user',
                    parts: [
                      { inlineData: { mimeType: imageMime, data: imageData } },
                      { text: 'Describe this ad image in 10 words or less. Format: category/description. Example: "automotive/vehicle close-up with dramatic lighting" or "design/typographic bold headline on gradient"' }
                    ]
                  }],
                  generationConfig: { temperature: 0.1, maxOutputTokens: 50 },
                }),
              }
            )
            if (summaryRes.ok) {
              const summaryResult = await summaryRes.json()
              conceptSummary = summaryResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
            }
          } catch {}
        }

        // Save to DB
        const dataUrl = `data:${imageMime};base64,${imageData}`
        const { data: saved } = await supabaseAdmin
          .from('generated_creatives')
          .insert({
            org_id: ORG_ID,
            client_id: clientId,
            prompt: fullPrompt,
            concept: conceptSummary || concept || null,
            aspect_ratio: aspectRatio,
            resolution,
            reference_ad_ids: [winnerImageUrl, ...referenceImageUrls].filter(Boolean),
            image_data: dataUrl,
            model: 'gemini-3-pro-image-preview',
            status: qa.pass ? 'completed' : 'qa_warning',
            metadata: {
              modelNotes,
              winnerName,
              winnerAnalysis: winnerAnalysis.slice(0, 2000),
              conceptSummary,
              qaPass: qa.pass,
              qaIssues: qa.issues,
              mode,
              referenceCount: refImages.length + (winnerImageData ? 1 : 0),
            },
            created_by: user.id,
          })
          .select('id')
          .single()

        // Log activity
        await supabaseAdmin.from('activity_log').insert({
          org_id: ORG_ID,
          actor_type: 'user',
          actor_id: user.id,
          actor_name: user.email,
          action: 'generated creative',
          target_type: 'client',
          target_id: clientId,
          metadata: { concept: conceptSummary, mode, aspectRatio, resolution, qaPass: qa.pass },
        })

        send({
          type: 'complete',
          id: saved?.id,
          imageData: dataUrl,
          modelNotes,
          winnerAnalysis,
          conceptSummary,
          qa: { pass: qa.pass, issues: qa.issues },
        })
      } catch (e: any) {
        console.error('Creative generation error:', e)
        send({ type: 'error', message: e.message || 'Generation failed' })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
