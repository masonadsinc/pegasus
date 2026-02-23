import { Nav } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabaseAdmin } from '@/lib/supabase'
import { formatNumber } from '@/lib/utils'
import Link from 'next/link'

export const revalidate = 30

const ORG_ID = process.env.ADSINC_ORG_ID!

async function getSyncData() {
  const [logsRes, accountsRes, insightsRes] = await Promise.all([
    supabaseAdmin
      .from('sync_logs')
      .select('*')
      .eq('org_id', ORG_ID)
      .order('completed_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('ad_accounts')
      .select('id, name, platform_account_id, is_active, last_synced_at, clients!inner(name)')
      .eq('org_id', ORG_ID)
      .eq('is_active', true)
      .order('last_synced_at', { ascending: false }),
    supabaseAdmin
      .from('insights')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ORG_ID),
  ])

  return {
    logs: logsRes.data || [],
    accounts: accountsRes.data || [],
    totalInsights: insightsRes.count || 0,
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const hours = diff / 3600000
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`
  if (hours < 24) return `${Math.floor(hours)}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default async function SyncPage() {
  const { logs, accounts, totalInsights } = await getSyncData()

  return (
    <main className="min-h-screen pb-8">
      <Nav current="settings" />

      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="mb-6">
          <div className="text-xs text-zinc-500 mb-1">
            <Link href="/settings" className="hover:text-zinc-300">Settings</Link>
            <span className="mx-1">/</span>
            <span className="text-zinc-300">Sync Status</span>
          </div>
          <h1 className="text-xl font-bold">Sync Status</h1>
          <p className="text-sm text-zinc-500">{formatNumber(totalInsights)} total insight rows · {accounts.length} active accounts</p>
        </div>

        {/* Account Sync Status */}
        <h2 className="text-sm font-semibold text-zinc-400 mb-3">Account Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {accounts.map((acc: any) => {
            const isStale = !acc.last_synced_at || (Date.now() - new Date(acc.last_synced_at).getTime()) > 86400000 * 2
            return (
              <Card key={acc.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{(acc.clients as any).name}</p>
                    <p className="text-xs text-zinc-500">act_{acc.platform_account_id}</p>
                  </div>
                  <div className="text-right">
                    <span className={`w-2 h-2 rounded-full inline-block ${isStale ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {acc.last_synced_at ? formatAgo(acc.last_synced_at) : 'Never'}
                    </p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Sync Log History */}
        <h2 className="text-sm font-semibold text-zinc-400 mb-3">Sync History</h2>
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="py-2 px-3 text-xs text-zinc-500 font-medium text-left">Time</th>
                  <th className="py-2 px-3 text-xs text-zinc-500 font-medium text-left">Type</th>
                  <th className="py-2 px-3 text-xs text-zinc-500 font-medium text-left">Range</th>
                  <th className="py-2 px-3 text-xs text-zinc-500 font-medium text-right">Records</th>
                  <th className="py-2 px-3 text-xs text-zinc-500 font-medium text-right">Errors</th>
                  <th className="py-2 px-3 text-xs text-zinc-500 font-medium text-right">Duration</th>
                  <th className="py-2 px-3 text-xs text-zinc-500 font-medium text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-zinc-800/50">
                    <td className="py-2 px-3 text-xs">{log.completed_at ? new Date(log.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</td>
                    <td className="py-2 px-3 text-xs">{log.sync_type}</td>
                    <td className="py-2 px-3 text-xs text-zinc-500">{log.date_range_start} → {log.date_range_end}</td>
                    <td className="py-2 px-3 text-xs text-right tabular-nums">{formatNumber(log.records_synced || 0)}</td>
                    <td className="py-2 px-3 text-xs text-right tabular-nums">{log.errors || 0}</td>
                    <td className="py-2 px-3 text-xs text-right tabular-nums">{log.duration_ms ? formatDuration(log.duration_ms) : '—'}</td>
                    <td className="py-2 px-3">
                      <Badge variant={log.status === 'success' ? 'excellent' : log.status === 'partial' ? 'warning' : 'critical'}>
                        {log.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-zinc-500">No sync logs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Schedule Info */}
        <Card className="p-4 mt-4">
          <h3 className="text-sm font-semibold mb-2">Sync Schedule</h3>
          <div className="text-xs text-zinc-500 space-y-1">
            <p>• <span className="text-zinc-300">Nightly sync:</span> 1:30 AM PST (9:30 UTC) — 7-day rolling window</p>
            <p>• <span className="text-zinc-300">Breakdowns:</span> Last 2 days only (saves API calls)</p>
            <p>• <span className="text-zinc-300">Structure:</span> Skipped if already synced today</p>
            <p>• <span className="text-zinc-300">Backfill:</span> 90 days loaded on initial setup</p>
          </div>
        </Card>
      </div>
    </main>
  )
}
