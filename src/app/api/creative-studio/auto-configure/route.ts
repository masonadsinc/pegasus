import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { logApiUsage, extractTokenCounts } from '@/lib/api-usage'

const ORG_ID = process.env.ADSINC_ORG_ID!

async function getGeminiKey(): Promise<string | null> {
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

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = await getGeminiKey()
  if (!apiKey) return NextResponse.json({ error: 'No Gemini API key configured' }, { status: 400 })

  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Get top performing ads with images
  const { data: accounts } = await supabaseAdmin
    .from('ad_accounts')
    .select('id, primary_action_type')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .limit(1)

  const account = accounts?.[0]
  if (!account) return NextResponse.json({ error: 'No active ad account' }, { status: 400 })

  const since = new Date()
  since.setDate(since.getDate() - 90)

  const { data: insights } = await supabaseAdmin
    .from('insights')
    .select('platform_ad_id, spend, impressions, clicks, leads, purchases, schedules')
    .eq('ad_account_id', account.id)
    .eq('level', 'ad')
    .gte('date', since.toISOString().split('T')[0])

  if (!insights?.length) return NextResponse.json({ error: 'No performance data found' }, { status: 400 })

  // Aggregate by ad
  const adMap = new Map<string, { spend: number; results: number }>()
  for (const row of insights) {
    const e = adMap.get(row.platform_ad_id) || { spend: 0, results: 0 }
    e.spend += row.spend || 0
    e.results += (row.leads || 0) + (row.purchases || 0) + (row.schedules || 0)
    adMap.set(row.platform_ad_id, e)
  }

  // Get ads with images that have results
  const topAdIds = Array.from(adMap.entries())
    .filter(([, s]) => s.results > 0 && s.spend > 0)
    .sort((a, b) => (a[1].spend / a[1].results) - (b[1].spend / b[1].results))
    .slice(0, 5)
    .map(([id]) => id)

  if (!topAdIds.length) return NextResponse.json({ error: 'No converting ads found' }, { status: 400 })

  const { data: adEntities } = await supabaseAdmin
    .from('ads')
    .select('platform_ad_id, name, creative_url, creative_headline, creative_body, creative_cta')
    .eq('ad_account_id', account.id)
    .in('platform_ad_id', topAdIds)

  const adsWithImages = (adEntities || []).filter(a => a.creative_url)
  if (!adsWithImages.length) return NextResponse.json({ error: 'No ads with images found' }, { status: 400 })

  // Download top 3 images
  const images: { data: string; mimeType: string; name: string }[] = []
  for (const ad of adsWithImages.slice(0, 3)) {
    const img = await fetchImageBase64(ad.creative_url!)
    if (img) images.push({ ...img, name: ad.name })
  }

  if (!images.length) return NextResponse.json({ error: 'Could not download any ad images' }, { status: 400 })

  // Send all images to Gemini Flash for brand analysis
  const parts: any[] = []
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
  }
  parts.push({ text: `You are analyzing ${images.length} top-performing ad creatives from the same brand. Your job is to extract the brand's visual identity by finding commonalities across these ads.

Respond in EXACTLY this JSON format (no markdown, no code blocks, just raw JSON):

{
  "brand_colors": [
    {"name": "Primary", "hex": "#XXXXXX"},
    {"name": "Secondary", "hex": "#XXXXXX"},
    {"name": "Accent/CTA", "hex": "#XXXXXX"},
    {"name": "Background", "hex": "#XXXXXX"},
    {"name": "Text", "hex": "#XXXXXX"}
  ],
  "visual_tone": "A single sentence describing the overall visual feel (e.g. 'Bold and modern with high contrast photography' or 'Natural and candid with warm earth tones')",
  "style_guide": "2-3 paragraphs covering: photography style (lighting, angles, subjects), typography approach (font style, weight, sizing), layout patterns (where text sits, how images fill the frame), color application (how colors are used across elements)",
  "creative_prefs": "What works: bullet points of patterns that appear in ALL the winning ads\\nWhat doesn't work: patterns to avoid based on what's NOT present in winners",
  "hard_rules": "Any absolute rules visible (e.g. 'No faces shown — only hands/arms', 'Always uses full-bleed imagery', 'CTA always at bottom in pill shape')"
}

Be SPECIFIC with hex codes — analyze the actual pixels, don't guess generic colors.
Only include colors that appear consistently across multiple ads.
If only 1 ad has a color, skip it.
Focus on patterns that repeat — those are the brand identity, not one-off choices.` })

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    return NextResponse.json({ error: `Analysis failed: ${response.status}` }, { status: 500 })
  }

  const result = await response.json()
  const tok = extractTokenCounts(result)
  logApiUsage({ model: 'gemini-3-flash-preview', feature: 'creative-studio-analysis', inputTokens: tok.inputTokens, outputTokens: tok.outputTokens, metadata: { type: 'auto-configure' } })

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Parse JSON from response (handle potential markdown wrapping)
  let parsed: any
  try {
    const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    parsed = JSON.parse(jsonStr)
  } catch {
    return NextResponse.json({ error: 'Could not parse brand analysis', raw: text }, { status: 500 })
  }

  // Save to brand_assets
  const { error: saveErr } = await supabaseAdmin
    .from('brand_assets')
    .upsert({
      org_id: ORG_ID,
      client_id: clientId,
      brand_colors: parsed.brand_colors || [],
      visual_tone: parsed.visual_tone || null,
      style_guide: parsed.style_guide || null,
      creative_prefs: parsed.creative_prefs || null,
      hard_rules: parsed.hard_rules || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,client_id' })

  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  await supabaseAdmin.from('activity_log').insert({
    org_id: ORG_ID, actor_type: 'user', actor_id: user.id, actor_name: user.email,
    action: 'auto-configured brand assets', target_type: 'client', target_id: clientId,
    metadata: { adsAnalyzed: images.length },
  })

  return NextResponse.json({
    success: true,
    assets: parsed,
    adsAnalyzed: images.map(i => i.name),
  })
}
