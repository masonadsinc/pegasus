'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'

interface Activity {
  id: string
  actor_name: string | null
  actor_type: string
  actor_id: string | null
  action: string
  category: string | null
  target_name: string | null
  target_type: string | null
  target_id: string | null
  client_id: string | null
  details: any
  metadata: any
  created_at: string
}

interface UserInfo {
  email: string
  role: string
}

const ACTOR_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  user: { bg: 'bg-[#eff6ff]', text: 'text-[#2563eb]', label: 'User' },
  ai: { bg: 'bg-[#f5f3ff]', text: 'text-[#7c3aed]', label: 'AI' },
  system: { bg: 'bg-[#f4f4f6]', text: 'text-[#6b6b76]', label: 'System' },
  cron: { bg: 'bg-[#fefce8]', text: 'text-[#f59e0b]', label: 'Cron' },
}

const ACTION_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  created: { icon: '+', bg: 'bg-[#f0fdf4]', color: 'text-[#16a34a]' },
  updated: { icon: '~', bg: 'bg-[#eff6ff]', color: 'text-[#2563eb]' },
  deleted: { icon: '-', bg: 'bg-[#fef2f2]', color: 'text-[#dc2626]' },
  removed: { icon: '-', bg: 'bg-[#fef2f2]', color: 'text-[#dc2626]' },
  generated: { icon: '*', bg: 'bg-[#fefce8]', color: 'text-[#f59e0b]' },
  exported: { icon: 'E', bg: 'bg-[#f0fdf4]', color: 'text-[#16a34a]' },
  analyzed: { icon: 'A', bg: 'bg-[#f5f3ff]', color: 'text-[#7c3aed]' },
  chat: { icon: 'C', bg: 'bg-[#f5f3ff]', color: 'text-[#7c3aed]' },
  invited: { icon: '+', bg: 'bg-[#f5f3ff]', color: 'text-[#7c3aed]' },
  synced: { icon: 'S', bg: 'bg-[#eff6ff]', color: 'text-[#2563eb]' },
  verified: { icon: 'V', bg: 'bg-[#f0fdf4]', color: 'text-[#16a34a]' },
}

function getActionIcon(action: string) {
  for (const [key, val] of Object.entries(ACTION_ICONS)) {
    if (action.includes(key)) return val
  }
  return { icon: '.', bg: 'bg-[#f4f4f6]', color: 'text-[#6b6b76]' }
}

const CATEGORY_LABELS: Record<string, string> = {
  auth: 'Auth',
  client: 'Clients',
  report: 'Reports',
  creative: 'Creative',
  ai: 'AI',
  sync: 'Sync',
  settings: 'Settings',
  export: 'Export',
  team: 'Team',
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

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatActionLabel(action: string) {
  return action.replace(/\./g, ' ').replace(/_/g, ' ')
}

const selectClass = "px-2.5 py-1.5 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[11px] text-[#6b6b76] focus:outline-none focus:border-[#2563eb] appearance-none cursor-pointer"

export function ActivityLog({ activities, userMap }: { activities: Activity[]; userMap: Record<string, UserInfo> }) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [actorTypeFilter, setActorTypeFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('7d')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const categories = useMemo(() => {
    const unique = new Set(activities.map(a => a.category).filter(Boolean))
    return Array.from(unique).sort() as string[]
  }, [activities])

  const actors = useMemo(() => {
    const unique = new Map<string, string>()
    activities.forEach(a => {
      const key = a.actor_id || a.actor_name || 'unknown'
      if (!unique.has(key)) unique.set(key, a.actor_name || 'Unknown')
    })
    return Array.from(unique.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [activities])

  const filtered = useMemo(() => {
    let result = activities

    if (categoryFilter !== 'all') {
      result = result.filter(a => a.category === categoryFilter)
    }
    if (actorTypeFilter !== 'all') {
      result = result.filter(a => a.actor_type === actorTypeFilter)
    }
    if (actorFilter !== 'all') {
      result = result.filter(a => (a.actor_id || a.actor_name || 'unknown') === actorFilter)
    }
    if (dateFilter !== 'all') {
      const now = Date.now()
      const cutoff = dateFilter === 'today' ? now - 86400000
        : dateFilter === '7d' ? now - 7 * 86400000
        : dateFilter === '30d' ? now - 30 * 86400000 : 0
      result = result.filter(a => new Date(a.created_at).getTime() > cutoff)
    }

    return result
  }, [activities, categoryFilter, actorTypeFilter, actorFilter, dateFilter])

  // Group by date
  const grouped = new Map<string, Activity[]>()
  for (const a of filtered) {
    const date = new Date(a.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const existing = grouped.get(date) || []
    existing.push(a)
    grouped.set(date, existing)
  }

  // Stats
  const todayCount = activities.filter(a => Date.now() - new Date(a.created_at).getTime() < 86400000).length
  const actorTypeCounts = { user: 0, ai: 0, system: 0, cron: 0 }
  activities.forEach(a => { if (a.actor_type in actorTypeCounts) actorTypeCounts[a.actor_type as keyof typeof actorTypeCounts]++ })

  const clearFilters = () => {
    setCategoryFilter('all')
    setActorTypeFilter('all')
    setActorFilter('all')
    setDateFilter('7d')
  }

  const hasFilters = categoryFilter !== 'all' || actorTypeFilter !== 'all' || actorFilter !== 'all' || dateFilter !== '7d'

  return (
    <div>
      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Card className="p-3 cursor-pointer hover:border-[#2563eb] transition-colors" onClick={() => { clearFilters(); setDateFilter('all') }}>
          <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Total Events</p>
          <p className="text-[18px] font-semibold tabular-nums mt-0.5">{activities.length}</p>
        </Card>
        <Card className="p-3 cursor-pointer hover:border-[#2563eb] transition-colors" onClick={() => { clearFilters(); setDateFilter('today') }}>
          <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Today</p>
          <p className="text-[18px] font-semibold tabular-nums mt-0.5">{todayCount}</p>
        </Card>
        {(['user', 'ai', 'system'] as const).map(type => (
          <Card key={type} className={`p-3 cursor-pointer hover:border-[#2563eb] transition-colors ${actorTypeFilter === type ? 'border-[#2563eb]' : ''}`}
            onClick={() => { setActorTypeFilter(actorTypeFilter === type ? 'all' : type) }}>
            <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">{ACTOR_COLORS[type].label}</p>
            <p className="text-[18px] font-semibold tabular-nums mt-0.5">{actorTypeCounts[type]}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={selectClass}>
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
        </select>
        <select value={actorTypeFilter} onChange={e => setActorTypeFilter(e.target.value)} className={selectClass}>
          <option value="all">All actor types</option>
          <option value="user">Users</option>
          <option value="ai">AI</option>
          <option value="system">System</option>
          <option value="cron">Cron</option>
        </select>
        <select value={actorFilter} onChange={e => setActorFilter(e.target.value)} className={selectClass}>
          <option value="all">All actors</option>
          {actors.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={selectClass}>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-[11px] text-[#9d9da8] hover:text-[#111113] px-2 py-1 rounded hover:bg-[#f4f4f6]">
            Clear
          </button>
        )}
        <span className="text-[10px] text-[#9d9da8] ml-auto">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-10 h-10 rounded-full bg-[#f4f4f6] flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9d9da8" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <p className="text-[13px] text-[#6b6b76]">No activity matching your filters</p>
          <p className="text-[11px] text-[#9d9da8] mt-1">Try widening your date range or clearing filters</p>
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
                    const actorStyle = ACTOR_COLORS[a.actor_type] || ACTOR_COLORS.system
                    const isExpanded = expandedId === a.id
                    const userInfo = a.actor_id ? userMap[a.actor_id] : null
                    const detailStr = typeof a.details === 'string' ? a.details : a.details ? JSON.stringify(a.details) : null

                    return (
                      <div key={a.id} className="px-5 py-3 hover:bg-[#fafafb] transition-colors cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={`w-7 h-7 rounded ${icon.bg} ${icon.color} text-[11px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            {icon.icon}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Actor badge */}
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${actorStyle.bg} ${actorStyle.text}`}>
                                {actorStyle.label}
                              </span>
                              {/* Actor name */}
                              <span className="text-[12px] font-semibold text-[#111113]">{a.actor_name || 'Unknown'}</span>
                              {userInfo && <span className="text-[10px] text-[#9d9da8]">{userInfo.role}</span>}
                            </div>

                            <p className="text-[12px] text-[#6b6b76] mt-0.5">
                              {formatActionLabel(a.action)}
                              {a.target_name && <>{' '}<span className="font-medium text-[#111113]">{a.target_name}</span></>}
                              {a.target_type && !a.target_name && <>{' '}<span className="text-[#9d9da8]">({a.target_type})</span></>}
                            </p>

                            {detailStr && !isExpanded && (
                              <p className="text-[11px] text-[#9d9da8] mt-0.5 truncate max-w-[500px]">{detailStr}</p>
                            )}

                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="mt-2 p-3 bg-[#f8f8fa] rounded text-[11px] space-y-1.5">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                                  <div><span className="text-[#9d9da8]">Event ID</span><p className="font-mono text-[10px] text-[#6b6b76]">{a.id}</p></div>
                                  <div><span className="text-[#9d9da8]">Timestamp</span><p className="text-[#6b6b76]">{new Date(a.created_at).toLocaleString()}</p></div>
                                  <div><span className="text-[#9d9da8]">Actor Type</span><p className="text-[#6b6b76]">{a.actor_type}</p></div>
                                  <div><span className="text-[#9d9da8]">Actor ID</span><p className="font-mono text-[10px] text-[#6b6b76]">{a.actor_id || '—'}</p></div>
                                  {a.category && <div><span className="text-[#9d9da8]">Category</span><p className="text-[#6b6b76]">{CATEGORY_LABELS[a.category] || a.category}</p></div>}
                                  {a.target_type && <div><span className="text-[#9d9da8]">Target Type</span><p className="text-[#6b6b76]">{a.target_type}</p></div>}
                                  {a.target_id && <div><span className="text-[#9d9da8]">Target ID</span><p className="font-mono text-[10px] text-[#6b6b76]">{a.target_id}</p></div>}
                                  {a.client_id && <div><span className="text-[#9d9da8]">Client ID</span><p className="font-mono text-[10px] text-[#6b6b76]">{a.client_id}</p></div>}
                                </div>
                                {detailStr && (
                                  <div className="pt-1.5 border-t border-[#e8e8ec]">
                                    <span className="text-[#9d9da8]">Details</span>
                                    <p className="text-[#6b6b76] mt-0.5 whitespace-pre-wrap break-all">{detailStr}</p>
                                  </div>
                                )}
                                {a.metadata && (
                                  <div className="pt-1.5 border-t border-[#e8e8ec]">
                                    <span className="text-[#9d9da8]">Metadata</span>
                                    <pre className="text-[10px] text-[#6b6b76] mt-0.5 font-mono whitespace-pre-wrap">{JSON.stringify(a.metadata, null, 2)}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Right side - time + category */}
                          <div className="flex items-center gap-3 shrink-0">
                            {a.category && (
                              <span className="text-[10px] font-medium text-[#9d9da8] bg-[#f4f4f6] px-2 py-0.5 rounded hidden sm:inline">
                                {CATEGORY_LABELS[a.category] || a.category}
                              </span>
                            )}
                            <div className="text-right">
                              <p className="text-[11px] text-[#9d9da8]">{formatTime(a.created_at)}</p>
                              <p className="text-[10px] text-[#c4c4cc]">{formatRelative(a.created_at)}</p>
                            </div>
                          </div>
                        </div>
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
