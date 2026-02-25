import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

// GET — fetch live ads or generated creatives
export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tab = req.nextUrl.searchParams.get('tab') || 'live'
  const clientId = req.nextUrl.searchParams.get('clientId')
  const pipelineStatus = req.nextUrl.searchParams.get('status')

  if (tab === 'live') {
    // Fetch live ad creatives with performance data
    let query = supabaseAdmin
      .from('ads')
      .select(`
        id, platform_ad_id, name, status, creative_url, creative_thumbnail_url, 
        creative_video_url, creative_headline, creative_body, creative_cta,
        ad_account_id, created_at
      `)
      .eq('status', 'ACTIVE')
      .not('creative_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)

    if (clientId) {
      // Get ad account IDs for this client
      const { data: accounts } = await supabaseAdmin
        .from('ad_accounts')
        .select('id')
        .eq('client_id', clientId)
        .eq('is_active', true)

      const accountIds = (accounts || []).map(a => a.id)
      if (accountIds.length === 0) return NextResponse.json({ ads: [] })
      query = query.in('ad_account_id', accountIds)
    }

    const { data: ads } = await query

    // Get performance data for these ads (last 30 days)
    const platformAdIds = (ads || []).map(a => a.platform_ad_id)
    const since = new Date()
    since.setDate(since.getDate() - 30)

    // Get account IDs for performance query
    const adAccountIds = [...new Set((ads || []).map(a => a.ad_account_id))]

    let performanceMap = new Map<string, { spend: number; results: number; impressions: number; clicks: number }>()

    if (platformAdIds.length > 0 && adAccountIds.length > 0) {
      const { data: insights } = await supabaseAdmin
        .from('insights')
        .select('platform_ad_id, spend, impressions, clicks, leads, purchases, schedules')
        .in('ad_account_id', adAccountIds)
        .eq('level', 'ad')
        .gte('date', since.toISOString().split('T')[0])
        .in('platform_ad_id', platformAdIds.slice(0, 500))

      for (const row of (insights || [])) {
        const existing = performanceMap.get(row.platform_ad_id) || { spend: 0, results: 0, impressions: 0, clicks: 0 }
        existing.spend += row.spend || 0
        existing.results += (row.leads || 0) + (row.purchases || 0) + (row.schedules || 0)
        existing.impressions += row.impressions || 0
        existing.clicks += row.clicks || 0
        performanceMap.set(row.platform_ad_id, existing)
      }
    }

    // Get client names for each ad account
    const { data: accountClients } = await supabaseAdmin
      .from('ad_accounts')
      .select('id, client_id, clients(name, slug)')
      .in('id', adAccountIds.length > 0 ? adAccountIds : ['__none__'])

    const accountClientMap = new Map<string, { name: string; slug: string; clientId: string }>()
    for (const ac of (accountClients || [])) {
      const client = ac.clients as any
      if (client) accountClientMap.set(ac.id, { name: client.name, slug: client.slug, clientId: ac.client_id })
    }

    const enriched = (ads || []).map(ad => {
      const perf = performanceMap.get(ad.platform_ad_id)
      const clientInfo = accountClientMap.get(ad.ad_account_id)
      return {
        ...ad,
        clientName: clientInfo?.name || 'Unknown',
        clientSlug: clientInfo?.slug || '',
        clientId: clientInfo?.clientId || '',
        spend: perf?.spend || 0,
        results: perf?.results || 0,
        impressions: perf?.impressions || 0,
        clicks: perf?.clicks || 0,
        cpr: perf && perf.results > 0 ? perf.spend / perf.results : 0,
        ctr: perf && perf.impressions > 0 ? (perf.clicks / perf.impressions) * 100 : 0,
        isVideo: !!ad.creative_video_url,
      }
    })

    return NextResponse.json({ ads: enriched })
  }

  if (tab === 'generated') {
    let query = supabaseAdmin
      .from('generated_creatives')
      .select('id, client_id, prompt, concept, aspect_ratio, resolution, image_data, model, status, metadata, created_at, pipeline_status, pipeline_notes, pipeline_updated_at, source')
      .eq('org_id', ORG_ID)
      .order('created_at', { ascending: false })
      .limit(200)

    if (clientId) query = query.eq('client_id', clientId)
    if (pipelineStatus && pipelineStatus !== 'all') query = query.eq('pipeline_status', pipelineStatus)

    const { data: creatives } = await query

    // Get client names
    const clientIds = [...new Set((creatives || []).map(c => c.client_id).filter(Boolean))]
    const { data: clientList } = await supabaseAdmin
      .from('clients')
      .select('id, name, slug')
      .in('id', clientIds.length > 0 ? clientIds : ['__none__'])

    const clientMap = new Map<string, { name: string; slug: string }>()
    for (const c of (clientList || [])) {
      clientMap.set(c.id, { name: c.name, slug: c.slug })
    }

    const enriched = (creatives || []).map(c => ({
      ...c,
      clientName: clientMap.get(c.client_id)?.name || 'Unknown',
      clientSlug: clientMap.get(c.client_id)?.slug || '',
      // Don't send full base64 in list — just a flag
      hasImage: !!c.image_data,
      image_data: undefined,
    }))

    // Pipeline counts
    const { data: countData } = await supabaseAdmin
      .from('generated_creatives')
      .select('pipeline_status')
      .eq('org_id', ORG_ID)
      .then(res => {
        const counts: Record<string, number> = {}
        for (const r of (res.data || [])) {
          const s = r.pipeline_status || 'needs_review'
          counts[s] = (counts[s] || 0) + 1
        }
        return { data: counts }
      })

    return NextResponse.json({ creatives: enriched, pipelineCounts: countData })
  }

  return NextResponse.json({ error: 'Invalid tab' }, { status: 400 })
}

// PATCH — update pipeline status
export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, pipeline_status, pipeline_notes } = await req.json()
  if (!id || !pipeline_status) return NextResponse.json({ error: 'id and pipeline_status required' }, { status: 400 })

  const validStatuses = ['needs_review', 'client_review', 'approved', 'live', 'not_used']
  if (!validStatuses.includes(pipeline_status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('generated_creatives')
    .update({
      pipeline_status,
      pipeline_notes: pipeline_notes || null,
      pipeline_updated_at: new Date().toISOString(),
      pipeline_updated_by: user.id,
    })
    .eq('id', id)
    .eq('org_id', ORG_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  await supabaseAdmin.from('activity_log').insert({
    org_id: ORG_ID,
    user_id: user.id,
    action: 'creative_status_change',
    details: { creative_id: id, new_status: pipeline_status, notes: pipeline_notes },
  })

  return NextResponse.json({ ok: true })
}
