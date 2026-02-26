import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

let cachedTz: string | null = null
let cacheTime = 0
const CACHE_MS = 5 * 60 * 1000 // 5 min

export async function getOrgTimezone(): Promise<string> {
  const now = Date.now()
  if (cachedTz && now - cacheTime < CACHE_MS) return cachedTz

  const { data } = await supabaseAdmin
    .from('organizations')
    .select('timezone')
    .eq('id', ORG_ID)
    .single()

  cachedTz = data?.timezone || 'America/Los_Angeles'
  cacheTime = now
  return cachedTz!
}

/** Get yesterday's date string in org timezone */
export function getYesterdayInTz(tz: string): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
  now.setDate(now.getDate() - 1)
  return now.toISOString().split('T')[0]
}

/** Get today's date string in org timezone */
export function getTodayInTz(tz: string): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: tz })).toISOString().split('T')[0]
}

/** Get a Date object representing "now" in org timezone */
export function getNowInTz(tz: string): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
}

/** Short timezone label for display */
export function tzLabel(tz: string): string {
  const map: Record<string, string> = {
    'America/Los_Angeles': 'PST',
    'America/Denver': 'MST',
    'America/Chicago': 'CST',
    'America/New_York': 'EST',
    'UTC': 'UTC',
  }
  return map[tz] || tz
}

export const TIMEZONE_OPTIONS = [
  { value: 'America/Los_Angeles', label: 'Pacific (PST/PDT)' },
  { value: 'America/Denver', label: 'Mountain (MST/MDT)' },
  { value: 'America/Chicago', label: 'Central (CST/CDT)' },
  { value: 'America/New_York', label: 'Eastern (EST/EDT)' },
  { value: 'UTC', label: 'UTC' },
]
