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

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = await getGeminiKey()
  if (!apiKey) return NextResponse.json({ error: 'No Gemini API key configured' }, { status: 400 })

  const { clientId, prompt, aspectRatio = '1:1', resolution = '4K', referenceImageUrls = [], concept = '' } = await req.json()
  if (!clientId || !prompt) return NextResponse.json({ error: 'clientId and prompt required' }, { status: 400 })

  // Build image size from resolution
  const sizeMap: Record<string, string> = { '1K': '1024', '2K': '2048', '4K': '4096' }
  const imageSize = sizeMap[resolution] || '4096'

  // Build the contents array — references first, then prompt
  const contents: any[] = []

  // Add reference images inline (fetch and convert to base64)
  const validRefs: string[] = []
  for (const url of referenceImageUrls.slice(0, 6)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue
      const buffer = await res.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mimeType = res.headers.get('content-type') || 'image/jpeg'
      contents.push({ inlineData: { mimeType, data: base64 } })
      validRefs.push(url)
    } catch {
      // Skip failed references
    }
  }

  // Build the full prompt with style instruction
  let fullPrompt = ''
  if (validRefs.length > 0) {
    fullPrompt += `Using the ${validRefs.length} reference image(s) provided as style guides, create an image that EXACTLY matches their visual style, color palette, typography style, layout patterns, and design aesthetic.\n\n`
  }
  fullPrompt += prompt
  fullPrompt += `\n\nNO LOGOS. Aspect ratio: ${aspectRatio}. Resolution: ${resolution}.`

  contents.push({ text: fullPrompt })

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
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
      console.error('Gemini error:', errText)
      return NextResponse.json({ error: `Gemini API error: ${response.status}` }, { status: 500 })
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
      if (part.text) {
        modelNotes += part.text
      }
    }

    if (!imageData) {
      return NextResponse.json({ error: 'No image generated. The model may have refused the prompt.' }, { status: 400 })
    }

    // Save to DB
    const { data: saved, error: saveErr } = await supabaseAdmin
      .from('generated_creatives')
      .insert({
        org_id: ORG_ID,
        client_id: clientId,
        prompt: fullPrompt,
        concept: concept || null,
        aspect_ratio: aspectRatio,
        resolution,
        reference_ad_ids: validRefs,
        image_data: `data:${imageMime};base64,${imageData}`,
        model: 'gemini-2.0-flash-exp',
        status: 'completed',
        metadata: { modelNotes, referenceCount: validRefs.length },
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
      metadata: { concept, aspectRatio, resolution, referenceCount: validRefs.length },
    })

    return NextResponse.json({
      id: saved?.id,
      imageData: `data:${imageMime};base64,${imageData}`,
      modelNotes,
      prompt: fullPrompt,
    })
  } catch (e: any) {
    console.error('Generation error:', e)
    return NextResponse.json({ error: e.message || 'Generation failed' }, { status: 500 })
  }
}
