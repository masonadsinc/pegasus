'use client'

import { useState, useMemo } from 'react'
import { formatCurrency, formatNumber, isEcomActionType } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type Status = 'excellent' | 'on-track' | 'watch' | 'attention' | 'no-data'
type SortKey = 'performance' | 'spend' | 'name'
type Filter = 'all' | 'active' | 'attention'

interface Account {
  client_name: string
  client_slug: string
  ad_account_id: string
  primary_action_type: string | null
  target_cpl: number | null
  target_roas: number | null
  spend: number
  results: number
  purchase_value: number
  result_label: string
  daily: { date: string; spend: number; results: number; purchase_value: number }[]
}

function getStatus(a: Account): Status {
  if (a.spend === 0) return 'no-data'
  const isEcom = isEcomActionType(a.primary_action_type)
  if (isEcom) {
    const roas = a.spend > 0 ? a.purchase_value / a.spend : 0
    if (!a.target_roas) return 'no-data'
    if (roas >= a.target_roas * 1.25) return 'excellent'
    if (roas >= a.target_roas) return 'on-track'
    if (roas >= a.target_roas * 0.75) return 'watch'
    return 'attention'
  }
  const cpr = a.results > 0 ? a.spend / a.results : 0
  if (!a.target_cpl || cpr === 0) return 'no-data'
  if (cpr <= a.target_cpl * 0.85) return 'excellent'
  if (cpr <= a.target_cpl) return 'on-track'
  if (cpr <= a.target_cpl * 1.25) return 'watch'
  return 'attention'
}

const statusCfg: Record<Status, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  excellent: { label: 'Excellent', variant: 'success' },
  'on-track': { label: 'On Track', variant: 'info' },
  watch: { label: 'Watch', variant: 'warning' },
  attention: { label: 'Attention', variant: 'danger' },
  'no-data': { label: 'No Data', variant: 'neutral' },
}

const statusOrder: Record<Status, number> = { attention: 0, watch: 1, 'on-track': 2, excellent: 3, 'no-data': 4 }

function DotHeatmap({ daily }: { daily: Account['daily'] }) {
  const dots = []
  for (let i = 0; i < 30; i++) {
    const day = daily[daily.length - 30 + i]
    if (!day || day.spend === 0) dots.push('bg-[#e8e8ec]')
    else if (day.results > 0) dots.push('bg-[#16a34a]')
    else dots.push('bg-[#f59e0b]')
  }
  return <div className="flex gap-[3px]">{dots.map((c, i) => <div key={i} className={`w-[7px] h-[7px] rounded-[2px] ${c} transition-transform hover:scale-150`} />)}</div>
}

function DaysOnTarget({ daily, targetCpl, targetRoas, isEcom }: { daily: Account['daily']; targetCpl: number | null; targetRoas: number | null; isEcom: boolean }) {
  const last30 = daily.slice(-30)
  let onTarget = 0, daysWithSpend = 0
  for (const d of last30) {
    if (d.spend === 0) continue
    daysWithSpend++
    if (isEcom) { if (targetRoas && d.spend > 0 && (d.purchase_value / d.spend) >= targetRoas) onTarget++ }
    else { if (targetCpl && d.results > 0 && (d.spend / d.results) <= targetCpl) onTarget++ }
  }
  if (!daysWithSpend) return null
  const pct = (onTarget / daysWithSpend) * 100
  const color = pct >= 60 ? '#16a34a' : pct >= 40 ? '#ea580c' : '#dc2626'
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-[#9d9da8] mb-1"><span>{onTarget}/{daysWithSpend} days on target</span></div>
      <div className="h-1.5 bg-[#f4f4f6] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} /></div>
    </div>
  )
}

function ClientCard({ account }: { account: Account }) {
  const status = getStatus(account)
  const cfg = statusCfg[status]
  const isEcom = isEcomActionType(account.primary_action_type)
  const cpr = account.results > 0 ? account.spend / account.results : 0
  const roas = account.spend > 0 ? account.purchase_value / account.spend : 0
  const cprOk = account.target_cpl ? cpr <= account.target_cpl : undefined
  const roasOk = account.target_roas ? roas >= account.target_roas : undefined

  return (
    <Link href={`/clients/${account.client_slug}`}>
      <div className="rounded-md bg-white border border-[#e8e8ec] p-5 card-hover cursor-pointer h-full">
        <div className="mb-3">
          <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider mb-1.5">Last 30 Days</p>
          <DotHeatmap daily={account.daily} />
        </div>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-[14px] text-[#111113]">{account.client_name}</h3>
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        </div>
        <div className="mb-4">
          <DaysOnTarget daily={account.daily} targetCpl={account.target_cpl} targetRoas={account.target_roas} isEcom={isEcom} />
        </div>
        <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider mb-2">Last 7 Days</p>
        <div className="flex items-center justify-between text-[13px] mb-1">
          <span className="text-[12px] text-[#9d9da8]">Spend</span>
          <span className="font-semibold tabular-nums">{formatCurrency(account.spend)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-[12px] text-[#9d9da8]">{isEcom ? 'Revenue' : account.result_label}</span>
          <span className="font-semibold tabular-nums">{isEcom ? formatCurrency(account.purchase_value) : formatNumber(account.results)}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-[#f4f4f6]">
          {isEcom ? (
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${roasOk ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`} />
                <span className="text-[12px] text-[#9d9da8]">ROAS</span>
                <span className="font-bold tabular-nums">{roas.toFixed(2)}x</span>
              </div>
              <span className="text-[12px] text-[#9d9da8]">Target <span className="font-medium">{account.target_roas || '—'}x</span></span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cprOk === true ? 'bg-[#16a34a]' : cprOk === false ? 'bg-[#dc2626]' : 'bg-[#9d9da8]'}`} />
                <span className="text-[12px] text-[#9d9da8]">CPR</span>
                <span className={`font-bold tabular-nums ${cprOk === false ? 'text-[#dc2626]' : cprOk === true ? 'text-[#16a34a]' : ''}`}>{cpr > 0 ? formatCurrency(cpr) : '—'}</span>
              </div>
              <span className="text-[12px] text-[#9d9da8]">Target <span className="font-medium">{account.target_cpl ? formatCurrency(account.target_cpl) : '—'}</span></span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export function ClientsGrid({ accounts }: { accounts: Account[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SortKey>('performance')

  const filtered = useMemo(() => {
    let list = [...accounts]
    if (filter === 'active') list = list.filter(a => a.spend > 0)
    if (filter === 'attention') list = list.filter(a => { const s = getStatus(a); return s === 'attention' || s === 'watch' })

    list.sort((a, b) => {
      if (sort === 'name') return a.client_name.localeCompare(b.client_name)
      if (sort === 'spend') return b.spend - a.spend
      // performance: worst first
      const sa = statusOrder[getStatus(a)]; const sb = statusOrder[getStatus(b)]
      if (sa !== sb) return sa - sb
      return b.spend - a.spend
    })
    return list
  }, [accounts, filter, sort])

  const counts = useMemo(() => {
    const c = { attention: 0, watch: 0, onTarget: 0 }
    accounts.filter(a => a.spend > 0).forEach(a => {
      const s = getStatus(a)
      if (s === 'attention') c.attention++
      else if (s === 'watch') c.watch++
      else if (s === 'on-track' || s === 'excellent') c.onTarget++
    })
    return c
  }, [accounts])

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'attention', label: 'Needs Attention' },
  ]

  const sorts: { key: SortKey; label: string }[] = [
    { key: 'performance', label: 'Performance' },
    { key: 'spend', label: 'Spend' },
    { key: 'name', label: 'Name' },
  ]

  return (
    <>
      {/* Status summary */}
      <div className="flex items-center justify-end gap-4 text-[12px] text-[#6b6b76] mb-4">
        {counts.attention > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#dc2626]" />{counts.attention} critical</span>}
        {counts.watch > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#ea580c]" />{counts.watch} over target</span>}
        {counts.onTarget > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#16a34a]" />{counts.onTarget} on target</span>}
      </div>

      {/* Filter + Sort bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1 bg-white border border-[#e8e8ec] rounded p-1">
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${filter === f.key ? 'bg-[#dc2626] text-white' : 'text-[#6b6b76] hover:bg-[#f4f4f6]'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-[#9d9da8]">Sort:</span>
          {sorts.map(s => (
            <button key={s.key} onClick={() => setSort(s.key)}
              className={`font-medium transition-colors ${sort === s.key ? 'text-[#111113]' : 'text-[#c4c4cc] hover:text-[#6b6b76]'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(a => <ClientCard key={a.ad_account_id} account={a} />)}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[#9d9da8]">No clients match this filter</div>
      )}
    </>
  )
}
