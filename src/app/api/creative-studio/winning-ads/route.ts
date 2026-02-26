import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrgId } from '@/lib/org'


// Returns top performing ads with creative URLs for use as reference images
export async function GET(req: NextRequest) {
  const ORG_ID = await getOrgId()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('clientId')
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10)
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Get active ad account
  const { data: accounts } = await supabaseAdmin
    .from('ad_accounts')
    .select('id, primary_action_type')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .limit(1)

  const account = accounts?.[0]
  if (!account) return NextResponse.json({ ads: [] })

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  // Get ad-level insights
  const { data: insights } = await supabaseAdmin
    .from('insights')
    .select('platform_ad_id, spend, impressions, clicks, leads, purchases, schedules')
    .eq('ad_account_id', account.id)
    .eq('level', 'ad')
    .gte('date', sinceStr)

  if (!insights?.length) return NextResponse.json({ ads: [] })

  // Aggregate by ad
  const adMap = new Map<string, { spend: number; results: number; clicks: number; impressions: number }>()
  for (const row of insights) {
    const existing = adMap.get(row.platform_ad_id) || { spend: 0, results: 0, clicks: 0, impressions: 0 }
    existing.spend += row.spend || 0
    existing.results += (row.leads || 0) + (row.purchases || 0) + (row.schedules || 0)
    existing.clicks += row.clicks || 0
    existing.impressions += row.impressions || 0
    adMap.set(row.platform_ad_id, existing)
  }

  // Get ad details with creative URLs
  const adIds = Array.from(adMap.keys())
  const { data: adEntities } = await supabaseAdmin
    .from('ads')
    .select('platform_ad_id, name, creative_url, creative_thumbnail_url, creative_video_url, creative_headline, creative_body, creative_cta, status')
    .eq('ad_account_id', account.id)
    .in('platform_ad_id', adIds)

  // Build results — only ads with images and results
  const results = (adEntities || [])
    .filter(ad => ad.creative_url && adMap.get(ad.platform_ad_id)?.results)
    .map(ad => {
      const stats = adMap.get(ad.platform_ad_id)!
      const cpr = stats.results > 0 ? stats.spend / stats.results : 0
      return {
        platformAdId: ad.platform_ad_id,
        name: ad.name,
        imageUrl: ad.creative_url,
        thumbnailUrl: ad.creative_thumbnail_url,
        videoUrl: ad.creative_video_url,
        headline: ad.creative_headline,
        body: ad.creative_body,
        cta: ad.creative_cta,
        status: ad.status,
        spend: stats.spend,
        results: stats.results,
        cpr,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
        isVideo: !!ad.creative_video_url,
      }
    })
    .sort((a, b) => a.cpr - b.cpr)
    .slice(0, 20)

  return NextResponse.json({ ads: results })
}
