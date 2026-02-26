import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { logApiUsage, extractTokenCounts } from '@/lib/api-usage'
import { getOrgId } from '@/lib/org'


async function getGeminiKey(ORG_ID: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('gemini_api_key')
    .eq('id', ORG_ID)
    .single()
  return data?.gemini_api_key || process.env.GEMINI_API_KEY || null
}

async function fetchImageBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    return { data: Buffer.from(buffer).toString('base64'), mimeType: res.headers.get('content-type') || 'image/jpeg' }
  } catch { return null }
}

// ============================================================
// WINNER ANALYSIS — extracts structured + narrative data
// ============================================================
interface WinnerBreakdown {
  raw: string
  containsPeople: boolean
  peopleDescription: string
  exactText: string[]
  visualStyle: string
  dominantColors: string
  layoutDescription: string
  emotionalTrigger: string
}

async function analyzeWinner(
  apiKey: string, imageBase64: string, imageMime: string,
  adName: string, stats: { spend: number; results: number; cpr: number; ctr: number }
): Promise<WinnerBreakdown> {
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
            { text: `You are analyzing a top-performing Meta ad creative. This ad has proven results: $${stats.spend.toFixed(0)} spend, ${stats.results} results at $${stats.cpr.toFixed(2)} CPR, ${stats.ctr.toFixed(2)}% CTR.

Your analysis will directly drive AI image generation of a new variation. Be extremely specific and visual — describe what you SEE, not what you think.

Respond in EXACTLY this format (keep the labels):

PEOPLE: [Yes/No]. [If yes: "Faces visible" or "Hands/arms only" or "Silhouette" etc. If no: just "No"]
EXACT_TEXT: [Transcribe EVERY piece of text exactly as written, line by line. Include headline, subtext, CTA button text, any badges or labels. Use | to separate lines]
VISUAL_STYLE: [One paragraph. Describe the visual approach as if briefing a photographer. Is it photorealistic? Graphic design? Typography-driven? What's the composition — full-bleed photo, split layout, centered subject? What's the dominant visual element?]
COLOR_PALETTE: [List the 3-5 most prominent colors with approximate hex codes. Note which is background, which is text, which is accent]
LAYOUT: [Describe spatial arrangement top-to-bottom. What occupies the top 20%? The middle? The bottom? Is text overlaid on the image or in separate sections? How much whitespace?]
CAMERA_FEEL: [If photorealistic: describe the apparent lens, angle, lighting, depth of field. "Shot from slightly above with a wide angle lens, soft diffused natural lighting, shallow depth of field blurring the background." If graphic: describe the design approach]
SCROLL_STOPPER: [In one sentence: what makes someone stop scrolling? What's the immediate visual hook?]
WHAT_WORKS: [Why does this specific combination of visual + text + layout convert? Be specific about the psychology]` }
          ]
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Winner analysis failed: ${response.status} - ${err}`)
  }

  const result = await response.json()
  const tokens = extractTokenCounts(result)
  logApiUsage({ model: 'gemini-3-flash-preview', feature: 'creative-studio-analysis', inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens })
  const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Parse structured fields from the analysis
  const peopleMatch = raw.match(/PEOPLE:\s*(.+?)(?:\n|$)/i)
  const textMatch = raw.match(/EXACT_TEXT:\s*([\s\S]+?)(?:\n[A-Z_]+:|$)/i)
  const styleMatch = raw.match(/VISUAL_STYLE:\s*([\s\S]+?)(?:\n[A-Z_]+:|$)/i)
  const colorMatch = raw.match(/COLOR_PALETTE:\s*([\s\S]+?)(?:\n[A-Z_]+:|$)/i)
  const layoutMatch = raw.match(/LAYOUT:\s*([\s\S]+?)(?:\n[A-Z_]+:|$)/i)
  const triggerMatch = raw.match(/SCROLL_STOPPER:\s*([\s\S]+?)(?:\n[A-Z_]+:|$)/i)

  const peopleStr = (peopleMatch?.[1] || '').trim()
  const containsPeople = /^yes/i.test(peopleStr)
  const exactTextRaw = (textMatch?.[1] || '').trim()
  const exactText = exactTextRaw.split('|').map((t: string) => t.trim()).filter(Boolean)

  return {
    raw: raw.replace(/\*\*(.+?)\*\*/g, '$1').replace(/#{1,4}\s*/g, '').replace(/`(.+?)`/g, '$1'),
    containsPeople,
    peopleDescription: peopleStr,
    exactText,
    visualStyle: (styleMatch?.[1] || '').trim(),
    dominantColors: (colorMatch?.[1] || '').trim(),
    layoutDescription: (layoutMatch?.[1] || '').trim(),
    emotionalTrigger: (triggerMatch?.[1] || '').trim(),
  }
}

// ============================================================
// QA CHECK — vision-based quality gate
// ============================================================
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
            { text: `You are a strict QA checker for AI-generated ad creatives destined for Meta Ads. This image must be PERFECT for paid advertising.

Check for these specific failures:
1. GIBBERISH TEXT — Any garbled, misspelled, or nonsensical text anywhere in the image? Read every single word carefully.
2. PLACEHOLDER LABELS — Does any text say "Headline", "Title", "Subheadline", "CTA", "Logo", "Your Text Here", "Brand Name"?
3. UNREADABLE TEXT — Any text too small, blurry, low-contrast, or obscured to read on a mobile phone?
4. CLUTTERED LAYOUT — More than 5-6 visual elements competing? Does it feel overwhelming?
5. DISTORTED ELEMENTS — Warped hands, extra fingers, melted faces, impossible physics?
6. SCREEN TEXT — Laptop/phone screens with illegible or garbled text?
7. LOGO ARTIFACTS — Any visible AI-generated logos, watermarks, or brand marks that look fake?

Be STRICT. This goes to paying clients. If in doubt, fail it.

Respond EXACTLY:
PASS: true OR PASS: false
ISSUES: [specific issues found, comma-separated, or "none"]` }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
    }
  )

  if (!response.ok) return { pass: true, issues: [] }

  const result = await response.json()
  const qaTok = extractTokenCounts(result)
  logApiUsage({ model: 'gemini-3-flash-preview', feature: 'creative-studio-qa', inputTokens: qaTok.inputTokens, outputTokens: qaTok.outputTokens })
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const pass = text.includes('PASS: true')
  const issueMatch = text.match(/ISSUES:\s*(.+)/i)
  const issues = issueMatch ? issueMatch[1].split(',').map((s: string) => s.trim()).filter((s: string) => s && s.toLowerCase() !== 'none') : []

  return { pass, issues }
}

// ============================================================
// PROMPT BUILDER — narrative, camera-aware, industry-smart
// ============================================================
function buildGenerationPrompt(
  analysis: WinnerBreakdown | null,
  brandAssets: any,
  client: any,
  historyList: string[],
  mode: string,
  aspectRatio: string,
  resolution: string,
  additionalDirection: string,
  hasUploadedImages: boolean = false,
): string {
  const parts: string[] = []

  // ─── PEOPLE CONSTRAINT (critical — from playbook) ───
  if (analysis && !analysis.containsPeople) {
    parts.push(`CRITICAL CONSTRAINT: The winning ad does NOT contain people. DO NOT add people, faces, portraits, hands, or human figures to the new ad. Match the winner — objects, environments, products, typography only.`)
  } else if (analysis?.containsPeople) {
    parts.push(`PEOPLE CONSTRAINT: The winning ad contains people (${analysis.peopleDescription}). You may include people in a similar way — match how they appear in the reference (faces visible vs. hands only, posed vs. candid).`)
  }

  // ─── WINNER CONTEXT (narrative, not structured) ───
  if (analysis) {
    parts.push(`THE WINNING AD — WHAT TO MATCH:
This ad is a proven performer. Here's exactly what makes it work:

Visual approach: ${analysis.visualStyle}

The scroll-stopping element: ${analysis.emotionalTrigger}

Color palette: ${analysis.dominantColors}

Layout structure: ${analysis.layoutDescription}

Why it converts: ${analysis.raw.match(/WHAT_WORKS:\s*([\s\S]+?)$/i)?.[1]?.trim() || 'Strong visual-copy alignment with clear CTA'}

Text that appeared on the winning ad (for reference — create NEW text with the same messaging angle):
${analysis.exactText.map(t => `"${t}"`).join('\n')}`)
  }

  // ─── BRAND COLORS (exact hex, mandatory) ───
  if (brandAssets?.brand_colors?.length > 0) {
    const colorLines = brandAssets.brand_colors.map((c: any) => `${c.name || 'Color'}: ${c.hex || c.value || c}`).join(', ')
    parts.push(`BRAND COLORS — USE THESE EXACT HEX CODES, no approximation:
${colorLines}
Apply them as the winner used its colors: primary for headlines, accent for CTA buttons, secondary for supporting elements.`)
  }

  // ─── STYLE GUIDE ───
  if (brandAssets?.style_guide) {
    parts.push(`BRAND STYLE GUIDE:\n${brandAssets.style_guide}`)
  }

  // ─── CREATIVE PREFERENCES (what works / doesn't) ───
  if (brandAssets?.creative_prefs) {
    parts.push(`CREATIVE DIRECTION — FOLLOW CLOSELY:\n${brandAssets.creative_prefs}`)
  }

  // ─── VISUAL TONE ───
  if (brandAssets?.visual_tone) {
    parts.push(`VISUAL TONE: ${brandAssets.visual_tone}`)
  }

  // ─── BRAND VOICE ───
  if (client?.brand_voice) {
    parts.push(`BRAND VOICE FOR COPY: ${client.brand_voice}`)
  }

  // ─── CREATIVE HISTORY (anti-repetition) ───
  if (historyList.length > 0) {
    parts.push(`AVOID REPEATING — these concepts were generated in the last 30 days:
${historyList.map(h => `- ${h}`).join('\n')}
Create something that explores a DIFFERENT visual territory.`)
  }

  // ─── HARD RULES FROM BRAND ASSETS ───
  if (brandAssets?.hard_rules) {
    parts.push(`HARD BRAND RULES — NEVER VIOLATE:\n${brandAssets.hard_rules}`)
  }

  // ─── UPLOADED CLIENT PHOTOS ───
  if (hasUploadedImages) {
    parts.push(`CLIENT PHOTOS PROVIDED — THIS IS CRITICAL:
Real photos from the client's business have been provided. These are the PRIMARY VISUAL CONTENT for the ad.

YOUR JOB: Take the winning ad's LAYOUT as a template and BUILD A NEW AD using the client's real photos as the hero visual.

What to keep from the winner:
- The overall layout structure (where headline sits, where CTA goes, spacing)
- The typography style (font weight, size relationships, color application)
- The text placement approach (overlay on image, separate section, etc.)
- The general color scheme and brand feel

What to change:
- The hero visual — use the client's REAL PHOTO(S) instead
- Write NEW headline text that fits the client's service/product
- Write NEW CTA text
- Adjust colors if needed to complement the client's photo

The client's photo should be the dominant visual element — full-bleed, edge-to-edge. 
Do NOT shrink it into a small box. Do NOT add AI-generated imagery on top of it.
The photo IS the ad — you're adding text and design elements ON TOP of/around it.`)
  }

  // ─── MODE-SPECIFIC INSTRUCTIONS ───
  if (mode === 'refresh') {
    parts.push(`GENERATION MODE: REFRESH — CREATIVE FATIGUE
The audience has seen too much of this style. Create something that feels genuinely NEW:
- Completely different visual approach (if the winner was photorealistic, try bold graphic design; if it was dark, try light; if it was busy, try minimal)
- Different headline angle — same value proposition, completely different framing
- Different emotional trigger — surprise them, don't repeat what they've already tuned out
- CONTRAST is the goal. Make someone who's scrolled past the current ads 20 times actually stop.`)
  } else {
    parts.push(`GENERATION MODE: VARIATION — SAME FAMILY, FRESH EXECUTION
Create a sibling creative that belongs in the same campaign:
- KEEP the visual style, energy, and production quality
- KEEP the general layout structure and color application
- KEEP the same camera feel and lighting approach
- CHANGE the headline to a different angle on the same value prop (same length, same impact, different words)
- CHANGE the visual subject to a different scene/moment/composition in the same style
- CHANGE the CTA wording slightly (same intent, fresh phrasing)

Think: "If a creative director said 'give me another one like this' — what would a senior designer produce?"`)
  }

  // ─── THE NARRATIVE GENERATION BRIEF ───
  // This is the core — describe the image as a scene, not a list of elements
  parts.push(`NOW CREATE THE AD IMAGE.

Describe what you're creating to yourself before generating — visualize the complete scene:

The image should feel like a professional ad creative produced by a top-tier agency. It needs to stop someone mid-scroll on their phone. Every element must be intentional.

TEXT RENDERING — THIS IS CRITICAL:
- Write a headline of 3-7 words. Bold, clean sans-serif typeface. It must be the first thing the eye hits.
- Write one line of supporting text (5-12 words). Smaller than the headline, positioned directly below.
- Write a CTA button (2-4 words) as a pill/rounded rectangle in the brand accent color, positioned in the bottom 15% of the image.
- ALL TEXT must be large enough to read on a phone at arm's length. If you're unsure, make it bigger.
- Every word must be spelled correctly. Every letter must be crisp and legible.
- The text should feel like it was designed by a typographer, not slapped on.

COMPOSITION:
- Full-bleed edge-to-edge. No white borders, no floating boxes, no clip art.
- The visual should fill the frame like a magazine cover or billboard.
- Create visual depth — use lighting, focus, and perspective to pull the eye in.

PHOTOGRAPHY DIRECTION (if photorealistic):
- Think in camera terms: what lens would capture this? (85mm for portraits/products with bokeh, 24mm wide angle for environments, 50mm for balanced scenes)
- What's the lighting? (Natural golden hour, soft diffused studio, overhead fluorescent, dramatic side-light)
- What's the angle? (Eye level for connection, slightly above for authority, low angle for power)
- What's in focus vs. soft? (Subject sharp, background with pleasing bokeh)

ABSOLUTE PROHIBITIONS:
- NO LOGOS of any kind (AI logos always look fake)
- NO placeholder text ("Headline", "CTA", "Your Brand")
- NO gibberish or misspelled words
- NO laptop/phone screens showing text (always illegible)
- NO clip art, stock photo feel, or generic compositions
- NO excessive elements — simplicity wins`)

  // ─── USER DIRECTION (last, as override) ───
  if (additionalDirection) {
    parts.push(`SPECIFIC DIRECTION FROM THE USER (prioritize this):\n${additionalDirection}`)
  }

  return parts.join('\n\n')
}

// ============================================================
// MAIN HANDLER
// ============================================================
export async function POST(req: NextRequest) {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = await getGeminiKey(ORG_ID)
  if (!apiKey) return NextResponse.json({ error: 'No Gemini API key configured' }, { status: 400 })

  const {
    clientId,
    winnerImageUrl,
    winnerName = 'Unknown Ad',
    winnerStats = {},
    aspectRatio = '1:1',
    resolution = '2K',
    additionalDirection = '',
    mode = 'variation', // variation | refresh | manual
    manualPrompt = '',
    referenceImageUrls = [],
    uploadedImages = [], // base64 data URLs from client photo uploads
    concept = '',
    source = 'creative-studio',
  } = await req.json()

  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Load brand assets + client info
        send({ type: 'status', message: 'Loading brand context and creative history...' })
        const [{ data: brandAssets }, { data: client }] = await Promise.all([
          supabaseAdmin.from('brand_assets').select('*').eq('org_id', ORG_ID).eq('client_id', clientId).single(),
          supabaseAdmin.from('clients').select('name, industry, brand_voice, ai_notes, business_description').eq('id', clientId).single(),
        ])

        // Load creative history for anti-repetition
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

        // Report what was loaded
        const brandColorCount = brandAssets?.brand_colors?.length || 0
        const hasStyleGuide = !!brandAssets?.style_guide
        const hasPrefs = !!brandAssets?.creative_prefs
        const contextParts = []
        if (brandColorCount > 0) contextParts.push(`${brandColorCount} brand colors`)
        if (hasStyleGuide) contextParts.push('style guide')
        if (hasPrefs) contextParts.push('creative prefs')
        if (historyList.length > 0) contextParts.push(`${historyList.length} past concepts (anti-repeat)`)
        if (contextParts.length > 0) {
          send({ type: 'status', message: `Loaded: ${contextParts.join(', ')}` })
        } else {
          send({ type: 'status', message: 'No brand assets found — generating with defaults' })
        }

        // Download and analyze the winner
        let analysis: WinnerBreakdown | null = null
        let winnerImageData: { data: string; mimeType: string } | null = null

        if (winnerImageUrl && mode !== 'manual') {
          send({ type: 'status', message: `Downloading winner: ${winnerName}` })
          winnerImageData = await fetchImageBase64(winnerImageUrl)

          if (winnerImageData) {
            send({ type: 'status', message: 'Analyzing winner with Gemini Flash vision — extracting colors, layout, text, people...' })
            analysis = await analyzeWinner(
              apiKey, winnerImageData.data, winnerImageData.mimeType, winnerName,
              { spend: winnerStats.spend || 0, results: winnerStats.results || 0, cpr: winnerStats.cpr || 0, ctr: winnerStats.ctr || 0 }
            )
            send({ type: 'analysis', text: analysis.raw })
          }
        }

        // Fetch additional reference images
        const refImages: { data: string; mimeType: string }[] = []
        for (const url of referenceImageUrls.slice(0, 5)) {
          const img = await fetchImageBase64(url)
          if (img) refImages.push(img)
        }

        // Build the prompt
        const uploadCount = uploadedImages.length
        const refCount = refImages.length + (winnerImageData ? 1 : 0)
        const briefParts = [`${mode} mode`, `${refCount} reference image(s)`]
        if (uploadCount > 0) briefParts.push(`${uploadCount} client photo(s)`)
        if (analysis?.containsPeople === false) briefParts.push('no-people constraint')
        if (analysis?.containsPeople === true) briefParts.push('people allowed')
        send({ type: 'status', message: `Building prompt: ${briefParts.join(', ')}` })
        let fullPrompt: string

        if (mode === 'manual' && manualPrompt) {
          fullPrompt = manualPrompt
        } else {
          fullPrompt = buildGenerationPrompt(
            analysis, brandAssets, client, historyList,
            mode, aspectRatio, resolution, additionalDirection,
            uploadedImages.length > 0
          )
        }

        // Build API contents — images FIRST (style anchor), prompt LAST
        send({ type: 'status', message: `Generating with Nano Banana Pro (${aspectRatio}, ${resolution}) — this may take 15-30s...` })
        const contents: any[] = []

        // Winner image first — strongest style influence
        if (winnerImageData) {
          contents.push({ inlineData: { mimeType: winnerImageData.mimeType, data: winnerImageData.data } })
          contents.push({ text: 'Above is the winning ad — the proven performer. Study every detail of its visual style, typography, color usage, composition, and overall aesthetic. Your generation must feel like it belongs in the exact same campaign.' })
        }

        // Additional references
        for (const ref of refImages) {
          contents.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } })
        }
        if (refImages.length > 0) {
          contents.push({ text: `Above are ${refImages.length} additional reference(s) from the same brand. Absorb their visual language.` })
        }

        // Uploaded client images (real photos to incorporate into the ad)
        const parsedUploads: { data: string; mimeType: string }[] = []
        for (const dataUrl of uploadedImages.slice(0, 6)) {
          const match = (dataUrl as string).match(/^data:([^;]+);base64,(.+)$/)
          if (match) {
            parsedUploads.push({ mimeType: match[1], data: match[2] })
            contents.push({ inlineData: { mimeType: match[1], data: match[2] } })
          }
        }
        if (parsedUploads.length > 0) {
          contents.push({ text: `Above are ${parsedUploads.length} REAL CLIENT PHOTO(S). These are actual images from the client's business — real work, real products, real environments. You MUST incorporate these photos as the primary visual content in the generated ad. Use the winning ad's LAYOUT, TYPOGRAPHY STYLE, TEXT PLACEMENT, and COLOR SCHEME, but replace the visual content with these real photos. The final ad should look like a professional designer took the client's photo and built a polished ad around it using the winning ad as a layout template.` })
        }

        // The generation prompt
        contents.push({ text: fullPrompt })

        // Map resolution to imageSize
        const imageSizeMap: Record<string, string> = { '1K': '1K', '2K': '2K', '4K': '4K' }
        const imageSize = imageSizeMap[resolution] || '2K'

        // Call Nano Banana Pro with proper imageConfig (per Google best practices)
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: contents }],
              generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
                temperature: 1.0,
                imageConfig: {
                  aspectRatio: aspectRatio,
                  imageSize: imageSize,
                },
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
        const genTok = extractTokenCounts(result)
        logApiUsage({ model: 'gemini-3.1-flash-image-preview', feature: 'creative-studio-generation', inputTokens: genTok.inputTokens, outputTokens: genTok.outputTokens, imagesGenerated: 1 })
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
        send({ type: 'status', message: 'Running QA check — scanning for gibberish, placeholders, layout issues...' })
        const qa = await qaCheck(apiKey, imageData, imageMime)

        if (!qa.pass) {
          send({ type: 'qa_warning', issues: qa.issues })
          send({ type: 'status', message: 'QA failed — regenerating with stricter text and layout constraints...' })

          // Retry with tighter prompt
          const retryContents = [...contents]
          retryContents.push({ text: `\n\nRETRY — PREVIOUS GENERATION FAILED QA. Issues found: ${qa.issues.join(', ')}.

This time, follow these STRICT rules:
- Keep the design SIMPLE — maximum 4 visual elements total
- Every single word must be spelled correctly — double-check before rendering
- NO placeholder text whatsoever
- Text must be VERY LARGE and HIGH CONTRAST (white on dark or dark on light)
- If you're unsure about rendering text, make it bigger and bolder
- Prioritize legibility over aesthetics` })

          const retryResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: retryContents }],
                generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 0.8, imageConfig: { aspectRatio, imageSize } },
              }),
            }
          )

          if (retryResponse.ok) {
            const retryResult = await retryResponse.json()
            for (const part of (retryResult.candidates?.[0]?.content?.parts || [])) {
              if (part.inlineData) { imageData = part.inlineData.data; imageMime = part.inlineData.mimeType || 'image/png' }
              if (part.text) modelNotes = part.text
            }
            // Re-QA the retry
            const qa2 = await qaCheck(apiKey, imageData!, imageMime)
            if (qa2.pass) { qa.pass = true; qa.issues = [] }
          }
        }

        // Concept summary for history tracking
        send({ type: 'status', message: 'Extracting concept summary and saving to database...' })
        let conceptSummary = concept
        if (!conceptSummary && imageData) {
          try {
            const summaryRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [
                    { inlineData: { mimeType: imageMime, data: imageData } },
                    { text: 'Describe this ad image in exactly 8-12 words. Format: category/specific description. Examples: "automotive/glossy black sedan in professional garage bay", "design/bold white headline on dark gradient with red CTA", "service/technician applying film to vehicle hood close-up"' }
                  ]}],
                  generationConfig: { temperature: 0.1, maxOutputTokens: 50 },
                }),
              }
            )
            if (summaryRes.ok) {
              const sr = await summaryRes.json()
              conceptSummary = sr.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
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
            model: 'gemini-3.1-flash-image-preview',
            status: qa.pass ? 'completed' : 'qa_warning',
            metadata: {
              modelNotes,
              winnerName,
              winnerAnalysis: analysis?.raw?.slice(0, 3000) || null,
              containsPeople: analysis?.containsPeople ?? null,
              winnerText: analysis?.exactText || [],
              conceptSummary,
              qaPass: qa.pass,
              qaIssues: qa.issues,
              mode,
              referenceCount: refImages.length + (winnerImageData ? 1 : 0),
            },
            created_by: user.id,
            source: source || 'creative-studio',
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
          winnerAnalysis: analysis?.raw || '',
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
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
