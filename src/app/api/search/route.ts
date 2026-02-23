import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ clients: [], ads: [] })

  const [clientsRes, adsRes] = await Promise.all([
    supabaseAdmin
      .from('clients')
      .select('name, slug')
      .eq('org_id', ORG_ID)
      .ilike('name', `%${q}%`)
      .limit(5),
    supabaseAdmin
      .from('ads')
      .select('platform_ad_id, name, creative_headline, ad_account_id')
      .eq('org_id', ORG_ID)
      .or(`name.ilike.%${q}%,creative_headline.ilike.%${q}%,creative_body.ilike.%${q}%`)
      .limit(8),
  ])

  // Get client slugs for ads
  const accountIds = [...new Set((adsRes.data || []).map(a => a.ad_account_id))]
  let accountClientMap = new Map<string, string>()
  if (accountIds.length > 0) {
    const { data: accounts } = await supabaseAdmin
      .from('ad_accounts')
      .select('id, clients!inner(slug)')
      .in('id', accountIds)
    for (const a of accounts || []) {
      accountClientMap.set(a.id, (a.clients as any)?.slug || '')
    }
  }

  return NextResponse.json({
    clients: (clientsRes.data || []).map(c => ({ name: c.name, slug: c.slug })),
    ads: (adsRes.data || []).map(a => ({
      id: a.platform_ad_id,
      name: a.name,
      headline: a.creative_headline,
      clientSlug: accountClientMap.get(a.ad_account_id) || '',
    })),
  })
}
