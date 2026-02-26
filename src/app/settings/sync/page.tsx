import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabaseAdmin } from '@/lib/supabase'
import { formatNumber } from '@/lib/utils'
import Link from 'next/link'
import { SyncSettings } from './sync-settings'

export const revalidate = 30
const ORG_ID = process.env.ADSINC_ORG_ID!

async function getSyncData() {
  const [orgRes, logsRes, accountsRes, insightsRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('sync_time, sync_enabled, timezone').eq('id', ORG_ID).single(),
    supabaseAdmin.from('sync_logs').select('*').eq('org_id', ORG_ID).order('completed_at', { ascending: false }).limit(20),
    supabaseAdmin.from('ad_accounts').select('id, name, platform_account_id, is_active, last_synced_at, clients!inner(name)').eq('org_id', ORG_ID).eq('is_active', true).order('last_synced_at', { ascending: false }),
    supabaseAdmin.from('insights').select('id', { count: 'exact', head: true }).eq('org_id', ORG_ID),
  ])

  const tzMap: Record<string, string> = {
    'America/Los_Angeles': 'PST', 'America/Denver': 'MST',
    'America/Chicago': 'CST', 'America/New_York': 'EST', 'UTC': 'UTC',
  }

  return {
    org: orgRes.data,
    tzLabel: tzMap[orgRes.data?.timezone || 'America/Los_Angeles'] || orgRes.data?.timezone || 'PST',
    logs: logsRes.data || [],
    accounts: accountsRes.data || [],
    totalInsights: insightsRes.count || 0,
  }
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const hours = diff / 3600000
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`
  if (hours < 24) return `${Math.floor(hours)}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default async function SyncPage() {
  const { org, tzLabel, logs, accounts, totalInsights } = await getSyncData()

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[1200px] mx-auto">
          <div className="text-[12px] text-[#9d9da8] mb-1">
            <Link href="/settings" className="hover:text-[#111113]">Settings</Link>
            <span className="mx-1.5">/</span>
            <span className="text-[#6b6b76]">Data Sync</span>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[20px] font-semibold text-[#111113]">Data Sync</h2>
              <p className="text-[13px] text-[#9d9da8]">{formatNumber(totalInsights)} insight rows across {accounts.length} active accounts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Sync Schedule — left column */}
            <div className="lg:col-span-1">
              <Card className="p-5">
                <h3 className="text-[13px] font-semibold text-[#111113] mb-1">Sync Schedule</h3>
                <p className="text-[11px] text-[#9d9da8] mb-4">When Meta ad data refreshes. Runs daily at the scheduled time in your organization timezone ({tzLabel}).</p>
                <SyncSettings
                  initialEnabled={org?.sync_enabled ?? true}
                  initialTime={org?.sync_time || '01:30'}
                  tzLabel={tzLabel}
                />
              </Card>
            </div>

            {/* Account Status — right columns */}
            <div className="lg:col-span-2">
              <h3 className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider mb-2">Account Status</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accounts.map((acc: any) => {
                  const isStale = !acc.last_synced_at || (Date.now() - new Date(acc.last_synced_at).getTime()) > 86400000 * 2
                  return (
                    <Card key={acc.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-[#111113] truncate">{(acc.clients as any).name}</p>
                          <p className="text-[10px] text-[#9d9da8] font-mono">act_{acc.platform_account_id}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-[#f59e0b]' : 'bg-[#16a34a]'}`} />
                          <p className="text-[10px] text-[#9d9da8]">{acc.last_synced_at ? formatAgo(acc.last_synced_at) : 'Never'}</p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
                {accounts.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-[13px] text-[#9d9da8]">No active ad accounts</div>
                )}
              </div>
            </div>
          </div>

          {/* Sync History */}
          <h3 className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider mb-2">Sync History</h3>
          <Card>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#e8e8ec]">
                    <th className="py-2.5 px-4 text-[10px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Time</th>
                    <th className="py-2.5 px-4 text-[10px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Type</th>
                    <th className="py-2.5 px-4 text-[10px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Range</th>
                    <th className="py-2.5 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Records</th>
                    <th className="py-2.5 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Errors</th>
                    <th className="py-2.5 px-4 text-[10px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Duration</th>
                    <th className="py-2.5 px-4 text-[10px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id} className="border-b border-[#f4f4f6] hover:bg-[#fafafb]">
                      <td className="py-2 px-4 text-[#111113]">{log.completed_at ? new Date(log.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</td>
                      <td className="py-2 px-4 text-[#6b6b76]">{log.sync_type}</td>
                      <td className="py-2 px-4 text-[#9d9da8]">{log.date_range_start} — {log.date_range_end}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{formatNumber(log.records_synced || 0)}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{log.errors || 0}</td>
                      <td className="py-2 px-4 text-right tabular-nums text-[#9d9da8]">{log.duration_ms ? formatDuration(log.duration_ms) : '—'}</td>
                      <td className="py-2 px-4">
                        <Badge variant={log.status === 'success' ? 'success' : log.status === 'partial' ? 'warning' : 'danger'}>{log.status}</Badge>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-[#9d9da8] text-[13px]">No sync logs yet</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </PageWrapper>
    </>
  )
}
