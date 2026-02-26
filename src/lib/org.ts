import { supabaseAdmin } from './supabase'
import { getUser } from './auth'

/**
 * Resolve the current organization ID.
 * 
 * Priority:
 * 1. User's org membership (multi-tenant ready)
 * 2. ADSINC_ORG_ID env var (single-tenant fallback)
 * 
 * For now, most routes still use process.env.ADSINC_ORG_ID directly.
 * This helper is the migration path toward full multi-tenant support.
 */
export async function getOrgId(): Promise<string> {
  // Try to resolve from authenticated user
  try {
    const user = await getUser()
    if (user) {
      const { data } = await supabaseAdmin
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (data?.org_id) return data.org_id
    }
  } catch {
    // Fall through to env var
  }

  // Fallback to env var
  const envOrg = process.env.ADSINC_ORG_ID
  if (!envOrg) throw new Error('No organization found. Please ensure ADSINC_ORG_ID is set or user is authenticated.')
  return envOrg
}

/**
 * Get org ID without auth (for cron/system calls).
 * Uses env var only.
 */
export function getOrgIdSync(): string {
  const envOrg = process.env.ADSINC_ORG_ID
  if (!envOrg) throw new Error('ADSINC_ORG_ID environment variable is required')
  return envOrg
}
