import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10)
  const since = new Date()
  since.setDate(since.getDate() - days)

  // Get raw usage logs
  const { data: logs } = await supabaseAdmin
    .from('api_usage')
    .select('*')
    .eq('org_id', ORG_ID)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  const entries = logs || []

  // Aggregate by feature
  const byFeature: Record<string, { calls: number; inputTokens: number; outputTokens: number; images: number; cost: number }> = {}
  for (const log of entries) {
    const f = log.feature
    if (!byFeature[f]) byFeature[f] = { calls: 0, inputTokens: 0, outputTokens: 0, images: 0, cost: 0 }
    byFeature[f].calls++
    byFeature[f].inputTokens += log.input_tokens || 0
    byFeature[f].outputTokens += log.output_tokens || 0
    byFeature[f].images += log.images_generated || 0
    byFeature[f].cost += parseFloat(log.estimated_cost) || 0
  }

  // Aggregate by model
  const byModel: Record<string, { calls: number; cost: number }> = {}
  for (const log of entries) {
    const m = log.model
    if (!byModel[m]) byModel[m] = { calls: 0, cost: 0 }
    byModel[m].calls++
    byModel[m].cost += parseFloat(log.estimated_cost) || 0
  }

  // Daily totals
  const byDay: Record<string, { calls: number; cost: number }> = {}
  for (const log of entries) {
    const day = log.created_at.split('T')[0]
    if (!byDay[day]) byDay[day] = { calls: 0, cost: 0 }
    byDay[day].calls++
    byDay[day].cost += parseFloat(log.estimated_cost) || 0
  }

  const totalCost = entries.reduce((sum, l) => sum + (parseFloat(l.estimated_cost) || 0), 0)
  const totalCalls = entries.length
  const totalTokens = entries.reduce((sum, l) => sum + (l.input_tokens || 0) + (l.output_tokens || 0), 0)

  return NextResponse.json({
    totalCost,
    totalCalls,
    totalTokens,
    byFeature,
    byModel,
    byDay,
    recentLogs: entries.slice(0, 50),
  })
}
