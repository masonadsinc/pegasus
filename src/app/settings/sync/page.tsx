import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabaseAdmin } from '@/lib/supabase'
import { formatNumber } from '@/lib/utils'
import Link from 'next/link'

export const revalidate = 30
const ORG_ID = process.env.ADSINC_ORG_ID!

async function getSyncData() {
  const [logsRes, accountsRes, insightsRes] = await Promise.all([
    supabaseAdmin.from('sync_logs').select('*').eq('org_id', ORG_ID).order('completed_at', { ascending: false }).limit(20),
    supabaseAdmin.from('ad_accounts').select('id, name, platform_account_id, is_active, last_synced_at, clients!inner(name)').eq('org_id', ORG_ID).eq('is_active', true).order('last_synced_at', { ascending: false }),
    supabaseAdmin.from('insights').select('id', { count: 'exact', head: true }).eq('org_id', ORG_ID),
  ])
  return { logs: logsRes.data || [], accounts: accountsRes.data || [], totalInsights: insightsRes.count || 0 }
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
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-8 max-w-[1200px] mx-auto">
          <div className="text-[12px] text-zinc-500 mb-3 flex items-center gap-1.5">
            <Link href="/settings" className="hover:text-white transition-colors">Settings</Link>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-300">Sync Status</span>
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-white">Sync Status</h1>
            <p className="text-sm text-zinc-500 mt-1">{formatNumber(totalInsights)} insight rows · {accounts.length} active accounts</p>
          </div>

          {/* Account Status */}
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Account Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {accounts.map((acc: any) => {
              const isStale = !acc.last_synced_at || (Date.now() - new Date(acc.last_synced_at).getTime()) > 86400000 * 2
              return (
                <Card key={acc.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium text-white">{(acc.clients as any).name}</p>
                      <p className="text-[11px] text-zinc-500">act_{acc.platform_account_id}</p>
                    </div>
                    <div className="text-right">
                      <span className={`w-2 h-2 rounded-full inline-block ${isStale ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <p className="text-[11px] text-zinc-500 mt-0.5">{acc.last_synced_at ? formatAgo(acc.last_synced_at) : 'Never'}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Sync History */}
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Sync History</h2>
          <Card>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    <th className="py-3 px-4 text-[11px] text-zinc-500 font-medium text-left uppercase tracking-wider">Time</th>
                    <th className="py-3 px-4 text-[11px] text-zinc-500 font-medium text-left uppercase tracking-wider">Type</th>
                    <th className="py-3 px-4 text-[11px] text-zinc-500 font-medium text-left uppercase tracking-wider">Range</th>
                    <th className="py-3 px-4 text-[11px] text-zinc-500 font-medium text-right uppercase tracking-wider">Records</th>
                    <th className="py-3 px-4 text-[11px] text-zinc-500 font-medium text-right uppercase tracking-wider">Errors</th>
                    <th className="py-3 px-4 text-[11px] text-zinc-500 font-medium text-right uppercase tracking-wider">Duration</th>
                    <th className="py-3 px-4 text-[11px] text-zinc-500 font-medium text-left uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id} className="border-b border-zinc-800/20 hover:bg-zinc-800/20">
                      <td className="py-3 px-4 text-zinc-300">{log.completed_at ? new Date(log.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</td>
                      <td className="py-3 px-4 text-zinc-400">{log.sync_type}</td>
                      <td className="py-3 px-4 text-zinc-500">{log.date_range_start} → {log.date_range_end}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-zinc-300">{formatNumber(log.records_synced || 0)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-zinc-400">{log.errors || 0}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-zinc-400">{log.duration_ms ? formatDuration(log.duration_ms) : '—'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={log.status === 'success' ? 'success' : log.status === 'partial' ? 'warning' : 'danger'}>{log.status}</Badge>
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

          {/* Schedule */}
          <Card className="p-5 mt-4">
            <h3 className="text-sm font-medium text-white mb-3">Sync Schedule</h3>
            <div className="text-[12px] text-zinc-500 space-y-1.5">
              <p><span className="text-zinc-300">Nightly sync:</span> 1:30 AM PST (9:30 UTC) — 7-day rolling window</p>
              <p><span className="text-zinc-300">Breakdowns:</span> Last 2 days only (saves API calls)</p>
              <p><span className="text-zinc-300">Structure:</span> Skipped if already synced today</p>
              <p><span className="text-zinc-300">Backfill:</span> 90 days loaded on initial setup</p>
            </div>
          </Card>
        </div>
      </PageWrapper>
    </>
  )
}
