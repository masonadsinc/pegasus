import React from 'react'
import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabaseAdmin } from '@/lib/supabase'
import { formatNumber } from '@/lib/utils'
import Link from 'next/link'
import { SyncSettings } from './sync-settings'
import { getOrgId } from '@/lib/org'

export const revalidate = 30
const ORG_ID = await getOrgId()

async function getSyncData() {
  const [orgRes, logsRes, accountsRes, insightsRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('sync_time, sync_enabled, timezone').eq('id', ORG_ID).single(),
    supabaseAdmin.from('sync_logs').select('*').eq('org_id', ORG_ID).order('completed_at', { ascending: false }).limit(20),
    supabaseAdmin.from('ad_accounts').select('id, name, platform_account_id, is_active, last_synced_at, clients!inner(name)').eq('org_id', ORG_ID).eq('is_active', true).order('last_synced_at', { ascending: false }),
    supabaseAdmin.from('insights').select('id', { count: 'exact', head: true }).eq('org_id', ORG_ID),
  ])

  // Get latest insight date per account (the REAL data freshness indicator)
  const accounts = accountsRes.data || []
  const accountsWithFreshness = await Promise.all(
    accounts.map(async (acc: any) => {
      const { data: latest } = await supabaseAdmin
        .from('insights')
        .select('date')
        .eq('ad_account_id', acc.id)
        .eq('level', 'campaign')
        .order('date', { ascending: false })
        .limit(1)
        .single()

      const { count } = await supabaseAdmin
        .from('insights')
        .select('id', { count: 'exact', head: true })
        .eq('ad_account_id', acc.id)

      const latestDate = latest?.date || null
      const now = new Date()
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      let daysGap = 0
      let status: 'current' | 'stale' | 'critical' | 'no-data' = 'no-data'
      if (latestDate) {
        const latestMs = new Date(latestDate).getTime()
        const yesterdayMs = new Date(yesterdayStr).getTime()
        daysGap = Math.floor((yesterdayMs - latestMs) / 86400000)
        if (daysGap <= 0) status = 'current'
        else if (daysGap <= 2) status = 'stale'
        else status = 'critical'
      }

      return {
        ...acc,
        latestDate,
        daysGap,
        status,
        insightCount: count || 0,
      }
    })
  )

  // Sort: critical first, then stale, then current
  const statusOrder: Record<string, number> = { critical: 0, stale: 1, 'no-data': 2, current: 3 }
  accountsWithFreshness.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))

  const tzMap: Record<string, string> = {
    'America/Los_Angeles': 'PST', 'America/Denver': 'MST',
    'America/Chicago': 'CST', 'America/New_York': 'EST', 'UTC': 'UTC',
  }

  return {
    org: orgRes.data,
    tzLabel: tzMap[orgRes.data?.timezone || 'America/Los_Angeles'] || orgRes.data?.timezone || 'PST',
    logs: logsRes.data || [],
    accounts: accountsWithFreshness,
    totalInsights: insightsRes.count || 0,
    currentCount: accountsWithFreshness.filter(a => a.status === 'current').length,
    staleCount: accountsWithFreshness.filter(a => a.status === 'stale' || a.status === 'critical').length,
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
  const { org, tzLabel, logs, accounts, totalInsights, currentCount, staleCount } = await getSyncData()
  const lastLog = logs[0]

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

          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Accounts</p>
              <p className="text-[18px] font-semibold tabular-nums mt-1">{accounts.length}</p>
              <p className="text-[11px] text-[#9d9da8]">active</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Up to Date</p>
              <p className="text-[18px] font-semibold tabular-nums mt-1 text-[#16a34a]">{currentCount}</p>
              <p className="text-[11px] text-[#9d9da8]">of {accounts.length} accounts</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Needs Attention</p>
              <p className={`text-[18px] font-semibold tabular-nums mt-1 ${staleCount > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{staleCount}</p>
              <p className="text-[11px] text-[#9d9da8]">{staleCount > 0 ? 'behind schedule' : 'all synced'}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Last Sync</p>
              <p className="text-[13px] font-semibold mt-1">{lastLog ? formatAgo(lastLog.completed_at) : 'Never'}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {lastLog && (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full ${lastLog.status === 'success' ? 'bg-[#16a34a]' : lastLog.status === 'partial' ? 'bg-[#f59e0b]' : 'bg-[#dc2626]'}`} />
                    <p className="text-[11px] text-[#9d9da8]">{lastLog.status}{lastLog.errors ? ` (${lastLog.errors} error${lastLog.errors > 1 ? 's' : ''})` : ''}</p>
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Sync Schedule */}
            <div className="lg:col-span-1">
              <Card className="p-5">
                <h3 className="text-[13px] font-semibold text-[#111113] mb-1">Sync Schedule</h3>
                <p className="text-[11px] text-[#9d9da8] mb-4">Runs daily at the scheduled time ({tzLabel}). Data syncs from Meta for all active ad accounts.</p>
                <SyncSettings
                  initialEnabled={org?.sync_enabled ?? true}
                  initialTime={org?.sync_time || '01:30'}
                  tzLabel={tzLabel}
                />
              </Card>
            </div>

            {/* Per-Account Data Freshness */}
            <div className="lg:col-span-2">
              <h3 className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider mb-2">Account Data Freshness</h3>
              <div className="space-y-1.5">
                {accounts.map((acc: any) => (
                  <Card key={acc.id} className={`p-3 ${acc.status === 'critical' ? 'border-[#fecaca] bg-[#fef2f2]' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            acc.status === 'current' ? 'bg-[#16a34a]' : 
                            acc.status === 'stale' ? 'bg-[#f59e0b]' : 
                            acc.status === 'critical' ? 'bg-[#dc2626]' : 'bg-[#d4d4d8]'
                          }`} />
                          <p className="text-[12px] font-medium text-[#111113] truncate">{(acc.clients as any).name}</p>
                        </div>
                        <p className="text-[10px] text-[#9d9da8] ml-4 font-mono">act_{acc.platform_account_id}</p>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-[11px] text-[#6b6b76]">Latest data</p>
                          <p className={`text-[12px] font-semibold tabular-nums ${
                            acc.status === 'critical' ? 'text-[#dc2626]' : 
                            acc.status === 'stale' ? 'text-[#f59e0b]' : 'text-[#111113]'
                          }`}>{acc.latestDate || 'No data'}</p>
                        </div>
                        <div className="text-right w-[60px]">
                          <p className="text-[11px] text-[#6b6b76]">Gap</p>
                          <p className={`text-[12px] font-semibold tabular-nums ${
                            acc.status === 'critical' ? 'text-[#dc2626]' : 
                            acc.status === 'stale' ? 'text-[#f59e0b]' : 'text-[#16a34a]'
                          }`}>{acc.status === 'no-data' ? '—' : acc.daysGap <= 0 ? 'Current' : `${acc.daysGap}d`}</p>
                        </div>
                        <div className="text-right w-[70px]">
                          <p className="text-[11px] text-[#6b6b76]">Last sync</p>
                          <p className="text-[11px] text-[#9d9da8] tabular-nums">{acc.last_synced_at ? formatAgo(acc.last_synced_at) : 'Never'}</p>
                        </div>
                        <div className="text-right w-[55px]">
                          <p className="text-[11px] text-[#6b6b76]">Rows</p>
                          <p className="text-[11px] text-[#9d9da8] tabular-nums">{formatNumber(acc.insightCount)}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                {accounts.length === 0 && (
                  <div className="text-center py-8 text-[13px] text-[#9d9da8]">No active ad accounts</div>
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
                    <React.Fragment key={log.id}>
                    <tr className="border-b border-[#f4f4f6] hover:bg-[#fafafb]">
                      <td className="py-2 px-4 text-[#111113]">{log.completed_at ? new Date(log.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</td>
                      <td className="py-2 px-4 text-[#6b6b76]">{log.sync_type}</td>
                      <td className="py-2 px-4 text-[#9d9da8]">{log.date_range_start} — {log.date_range_end}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{formatNumber(log.records_synced || 0)}</td>
                      <td className={`py-2 px-4 text-right tabular-nums ${log.errors > 0 ? 'text-[#dc2626] font-semibold' : ''}`}>{log.errors || 0}</td>
                      <td className="py-2 px-4 text-right tabular-nums text-[#9d9da8]">{log.duration_ms ? formatDuration(log.duration_ms) : '—'}</td>
                      <td className="py-2 px-4">
                        <Badge variant={log.status === 'success' ? 'success' : log.status === 'partial' ? 'warning' : 'danger'}>{log.status}</Badge>
                      </td>
                    </tr>
                    {log.error_details && Array.isArray(log.error_details) && (
                      <tr className="bg-[#fef2f2]">
                        <td colSpan={7} className="py-2 px-4 text-[11px] text-[#dc2626]">
                          {(log.error_details as any[]).map((e: any, i: number) => (
                            <span key={i}>{i > 0 ? ' · ' : ''}{e.account}: {e.error}</span>
                          ))}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
