'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'

interface Activity {
  id: string
  actor_name: string | null
  actor_type: string
  action: string
  target_name: string | null
  target_type: string | null
  details: string | null
  created_at: string
}

function getActionIcon(action: string) {
  if (action.includes('created')) return { bg: 'bg-[#f0fdf4]', color: 'text-[#16a34a]', icon: '+' }
  if (action.includes('deleted') || action.includes('removed')) return { bg: 'bg-[#fef2f2]', color: 'text-[#dc2626]', icon: '-' }
  if (action.includes('updated')) return { bg: 'bg-[#eff6ff]', color: 'text-[#2563eb]', icon: '~' }
  if (action.includes('invited')) return { bg: 'bg-[#f5f3ff]', color: 'text-[#7c3aed]', icon: '+' }
  if (action.includes('generated')) return { bg: 'bg-[#fefce8]', color: 'text-[#f59e0b]', icon: '*' }
  return { bg: 'bg-[#f4f4f6]', color: 'text-[#6b6b76]', icon: '.' }
}

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  if (hr < 24) return `${hr}h ago`
  if (day < 7) return `${day}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const selectClass = "px-2.5 py-1.5 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[11px] text-[#6b6b76] focus:outline-none focus:border-[#2563eb] appearance-none cursor-pointer"

const DATE_FILTERS = [
  { label: 'All time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
]

const ACTION_FILTERS = [
  { label: 'All actions', value: 'all' },
  { label: 'Created', value: 'created' },
  { label: 'Updated', value: 'updated' },
  { label: 'Deleted', value: 'deleted' },
  { label: 'Generated', value: 'generated' },
  { label: 'Invited', value: 'invited' },
]

export function ActivityLog({ activities }: { activities: Activity[] }) {
  const [actionFilter, setActionFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  const actors = useMemo(() => {
    const unique = new Set(activities.map(a => a.actor_name || 'System'))
    return ['all', ...Array.from(unique).sort()]
  }, [activities])

  const filtered = useMemo(() => {
    let result = activities

    if (actionFilter !== 'all') {
      result = result.filter(a => a.action.includes(actionFilter))
    }
    if (actorFilter !== 'all') {
      result = result.filter(a => (a.actor_name || 'System') === actorFilter)
    }
    if (dateFilter !== 'all') {
      const now = Date.now()
      const cutoff = dateFilter === 'today' ? now - 86400000
        : dateFilter === '7d' ? now - 7 * 86400000
        : dateFilter === '30d' ? now - 30 * 86400000 : 0
      result = result.filter(a => new Date(a.created_at).getTime() > cutoff)
    }

    return result
  }, [activities, actionFilter, actorFilter, dateFilter])

  // Group by date
  const grouped = new Map<string, Activity[]>()
  for (const a of filtered) {
    const date = new Date(a.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const existing = grouped.get(date) || []
    existing.push(a)
    grouped.set(date, existing)
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className={selectClass}>
          {ACTION_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={actorFilter} onChange={e => setActorFilter(e.target.value)} className={selectClass}>
          <option value="all">All users</option>
          {actors.filter(a => a !== 'all').map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={selectClass}>
          {DATE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        {(actionFilter !== 'all' || actorFilter !== 'all' || dateFilter !== 'all') && (
          <button onClick={() => { setActionFilter('all'); setActorFilter('all'); setDateFilter('all') }} className="text-[11px] text-[#9d9da8] hover:text-[#111113] px-2 py-1 rounded hover:bg-[#f4f4f6]">
            Clear filters
          </button>
        )}
        <span className="text-[10px] text-[#9d9da8] ml-auto">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[13px] text-[#9d9da8]">No matching activity</p>
          <p className="text-[12px] text-[#c4c4cc] mt-1">Try adjusting your filters.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-[11px] font-medium text-[#9d9da8] uppercase tracking-wider mb-2">{date}</h3>
              <Card>
                <div className="divide-y divide-[#f4f4f6]">
                  {items.map(a => {
                    const icon = getActionIcon(a.action)
                    return (
                      <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                        <div className={`w-6 h-6 rounded ${icon.bg} ${icon.color} text-[11px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          {icon.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-[#111113]">
                            <span className="font-medium">{a.actor_name || 'System'}</span>
                            {' '}{a.action}{' '}
                            {a.target_name && <span className="font-medium">{a.target_name}</span>}
                          </p>
                          {a.details && (
                            <p className="text-[11px] text-[#9d9da8] mt-0.5 truncate">{typeof a.details === 'string' ? a.details : JSON.stringify(a.details)}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-[#9d9da8] flex-shrink-0">{formatRelative(a.created_at)}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
