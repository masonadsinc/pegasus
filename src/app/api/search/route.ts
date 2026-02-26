import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { getOrgId } from '@/lib/org'


// Escape special Postgres LIKE characters
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&')
}

export async function GET(req: NextRequest) {
  const ORG_ID = await getOrgId()
  try {
    // Auth check
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = req.nextUrl.searchParams.get('q')?.trim()
    if (!q || q.length < 2) return NextResponse.json({ clients: [], ads: [] })

    const safe = escapeLike(q)

    const [clientsRes, adsRes] = await Promise.all([
      supabaseAdmin
        .from('clients')
        .select('name, slug')
        .eq('org_id', ORG_ID)
        .ilike('name', `%${safe}%`)
        .limit(5),
      supabaseAdmin
        .from('ads')
        .select('platform_ad_id, name, creative_headline, ad_account_id')
        .eq('org_id', ORG_ID)
        .or(`name.ilike.%${safe}%,creative_headline.ilike.%${safe}%,creative_body.ilike.%${safe}%`)
        .limit(8),
    ])

    if (clientsRes.error) throw clientsRes.error
    if (adsRes.error) throw adsRes.error

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
  } catch (e: any) {
    console.error('Search API error:', e)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
