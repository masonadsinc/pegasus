import { supabaseAdmin } from '@/lib/supabase'

export type ActorType = 'user' | 'ai' | 'system' | 'cron'
export type ActionCategory = 'auth' | 'client' | 'report' | 'creative' | 'ai' | 'sync' | 'settings' | 'export' | 'team'

interface LogActivityParams {
  orgId: string
  actorType: ActorType
  actorId?: string | null
  actorName?: string | null
  action: string
  category?: ActionCategory
  targetType?: string | null
  targetId?: string | null
  targetName?: string | null
  clientId?: string | null
  details?: string | Record<string, any> | null
  metadata?: Record<string, any> | null
}

export async function logActivity(params: LogActivityParams) {
  try {
    await supabaseAdmin.from('activity_log').insert({
      org_id: params.orgId,
      actor_type: params.actorType,
      actor_id: params.actorId || null,
      actor_name: params.actorName || null,
      action: params.action,
      category: params.category || inferCategory(params.action),
      target_type: params.targetType || null,
      target_id: params.targetId || null,
      target_name: params.targetName || null,
      client_id: params.clientId || null,
      details: params.details || null,
      metadata: params.metadata || null,
    })
  } catch (e) {
    // Activity logging should never break the main flow
    console.error('Activity log error:', e)
  }
}

function inferCategory(action: string): ActionCategory {
  if (action.startsWith('report')) return 'report'
  if (action.startsWith('client')) return 'client'
  if (action.startsWith('creative') || action.startsWith('image') || action.startsWith('copy')) return 'creative'
  if (action.startsWith('pegasus') || action.startsWith('ai')) return 'ai'
  if (action.startsWith('sync')) return 'sync'
  if (action.startsWith('team') || action.startsWith('member')) return 'team'
  if (action.startsWith('export')) return 'export'
  if (action.startsWith('setting') || action.startsWith('agency')) return 'settings'
  return 'settings'
}

// Convenience helpers
export function userActor(user: { id: string; email?: string; name?: string }) {
  return {
    actorType: 'user' as ActorType,
    actorId: user.id,
    actorName: user.name || user.email || 'Unknown user',
  }
}

export function aiActor(name = 'Pegasus') {
  return {
    actorType: 'ai' as ActorType,
    actorId: null,
    actorName: name,
  }
}

export function systemActor() {
  return {
    actorType: 'system' as ActorType,
    actorId: null,
    actorName: 'System',
  }
}

export function cronActor() {
  return {
    actorType: 'cron' as ActorType,
    actorId: null,
    actorName: 'Cron',
  }
}
