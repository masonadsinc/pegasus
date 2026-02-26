import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!
const CRON_SECRET = process.env.CRON_SECRET

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function GET(req: NextRequest) {
  // Auth: Vercel cron header, Bearer token, or logged-in user
  const cronAuth = req.headers.get('authorization')
  const vercelCron = req.headers.get('x-vercel-cron') // Vercel sets this automatically
  const isCronAuthed = vercelCron === '1' || (CRON_SECRET && cronAuth === `Bearer ${CRON_SECRET}`)

  if (!isCronAuthed) {
    const { getUser } = await import('@/lib/auth')
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get org settings
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('report_day, report_time, report_auto_generate, report_default_days, timezone')
    .eq('id', ORG_ID)
    .single()

  if (!org?.report_auto_generate) {
    return NextResponse.json({ skipped: true, reason: 'Auto-generate is off' })
  }

  const tz = org.timezone || 'America/Los_Angeles'
  const now = new Date()
  const localTime = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  const currentDay = localTime.getDay()
  const currentHour = localTime.getHours()
  const currentMinute = localTime.getMinutes()
  const [targetHour, targetMinute] = (org.report_time || '08:00').split(':').map(Number)

  // Check if it's the right day
  if (currentDay !== (org.report_day ?? 1)) {
    return NextResponse.json({ 
      skipped: true, 
      reason: `Not report day. Current: ${DAY_NAMES[currentDay]}, Target: ${DAY_NAMES[org.report_day ?? 1]}` 
    })
  }

  // Check if within the target hour window (run once per hour window)
  if (currentHour !== targetHour) {
    return NextResponse.json({ 
      skipped: true, 
      reason: `Not report time. Current: ${currentHour}:${String(currentMinute).padStart(2, '0')}, Target: ${org.report_time}` 
    })
  }

  // Get per-client overrides
  const { data: overrides } = await supabaseAdmin
    .from('report_schedules')
    .select('client_id, report_day, period_days, enabled')
    .eq('org_id', ORG_ID)

  const overrideMap = new Map<string, any>()
  for (const o of (overrides || [])) overrideMap.set(o.client_id, o)

  // Get active clients
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, ad_accounts(id, is_active)')
    .eq('org_id', ORG_ID)
    .eq('status', 'active')

  const activeClients = (clients || []).filter(c =>
    (c.ad_accounts as any[])?.some((a: any) => a.is_active)
  )

  // Filter: only clients that should generate today
  const clientsToGenerate: string[] = []
  const skippedClients: string[] = []

  for (const client of activeClients) {
    const override = overrideMap.get(client.id)

    // Per-client disabled
    if (override?.enabled === false) {
      skippedClients.push(`${client.name} (disabled)`)
      continue
    }

    // Per-client different day
    if (override?.report_day !== null && override?.report_day !== undefined && override.report_day !== currentDay) {
      skippedClients.push(`${client.name} (scheduled for ${DAY_NAMES[override.report_day]})`)
      continue
    }

    clientsToGenerate.push(client.id)
  }

  if (clientsToGenerate.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'No clients to generate for today', skippedClients })
  }

  // Call the generate endpoint internally
  const defaultDays = org.report_default_days || 7

  // Build per-client days map from overrides
  const generateResults: any[] = []

  // Group by period_days to batch
  const byDays = new Map<number, string[]>()
  for (const cid of clientsToGenerate) {
    const override = overrideMap.get(cid)
    const days = override?.period_days || defaultDays
    if (!byDays.has(days)) byDays.set(days, [])
    byDays.get(days)!.push(cid)
  }

  // Generate in batches via internal fetch
  const baseUrl = req.nextUrl.origin
  for (const [days, cids] of byDays) {
    try {
      const res = await fetch(`${baseUrl}/api/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vercel-cron': '1',
          ...(CRON_SECRET ? { 'Authorization': `Bearer ${CRON_SECRET}` } : {}),
        },
        body: JSON.stringify({ clientIds: cids, days }),
      })
      const data = await res.json()
      generateResults.push({ days, clients: cids.length, results: data.results })
    } catch (e: any) {
      generateResults.push({ days, clients: cids.length, error: e.message })
    }
  }

  // Log
  await supabaseAdmin.from('activity_log').insert({
    org_id: ORG_ID,
    actor_type: 'system',
    actor_id: 'auto-generate',
    actor_name: 'Report Auto-Generator',
    action: 'auto-generated reports',
    target_type: 'report',
    details: `${clientsToGenerate.length} clients, ${skippedClients.length} skipped`,
  })

  return NextResponse.json({
    generated: clientsToGenerate.length,
    skipped: skippedClients.length,
    skippedClients,
    results: generateResults,
  })
}
