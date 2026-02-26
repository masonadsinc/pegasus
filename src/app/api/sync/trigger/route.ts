import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrgTimezone, getNowInTz } from '@/lib/timezone'
import { getOrgIdSync } from '@/lib/org'
import { logActivity, cronActor } from '@/lib/activity'

const ORG_ID = getOrgIdSync()

/**
 * GET /api/sync/trigger
 * 
 * Called by the VPS cron every hour. Returns whether the sync should run now.
 * The VPS script calls this endpoint, and if should_sync=true, runs the sync locally.
 * 
 * Also callable manually with ?manual=1 by logged-in users to check status.
 */
export async function GET(req: NextRequest) {
  // Auth: check for cron secret or user auth
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const { getUser } = await import('@/lib/auth')
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('sync_time, sync_enabled, timezone')
    .eq('id', ORG_ID)
    .single()

  const tz = org?.timezone || await getOrgTimezone()
  const now = getNowInTz(tz)
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const [targetHour, targetMinute] = (org?.sync_time || '01:30').split(':').map(Number)

  const isManual = req.nextUrl.searchParams.get('manual') === '1'

  // For manual checks, just return current config
  if (isManual) {
    return NextResponse.json({
      sync_enabled: org?.sync_enabled ?? true,
      sync_time: org?.sync_time || '01:30',
      timezone: tz,
      current_time: `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`,
      should_sync: false,
      note: 'Manual status check only',
    })
  }

  if (!org?.sync_enabled) {
    return NextResponse.json({ should_sync: false, reason: 'Sync is disabled' })
  }

  if (currentHour !== targetHour) {
    return NextResponse.json({
      should_sync: false,
      reason: `Not sync time. Current: ${currentHour}:${String(currentMinute).padStart(2, '0')}, Target: ${org?.sync_time || '01:30'}`,
    })
  }

  return NextResponse.json({
    should_sync: true,
    sync_time: org?.sync_time || '01:30',
    timezone: tz,
  })
}
