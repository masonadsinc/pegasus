import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 30
const ORG_ID = process.env.ADSINC_ORG_ID!

async function getActivity() {
  const { data } = await supabaseAdmin
    .from('activity_log')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(100)
  return data || []
}

function getActionIcon(action: string) {
  if (action.includes('created')) return { bg: 'bg-[#f0fdf4]', color: 'text-[#16a34a]', icon: '+' }
  if (action.includes('deleted') || action.includes('removed')) return { bg: 'bg-[#fef2f2]', color: 'text-[#dc2626]', icon: '-' }
  if (action.includes('updated')) return { bg: 'bg-[#eff6ff]', color: 'text-[#2563eb]', icon: '~' }
  if (action.includes('invited')) return { bg: 'bg-[#f5f3ff]', color: 'text-[#7c3aed]', icon: '+' }
  return { bg: 'bg-[#f4f4f6]', color: 'text-[#6b6b76]', icon: '.' }
}

function formatRelative(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function ActivityPage() {
  const activity = await getActivity()

  // Group by date
  const grouped = new Map<string, typeof activity>()
  for (const a of activity) {
    const date = new Date(a.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const existing = grouped.get(date) || []
    existing.push(a)
    grouped.set(date, existing)
  }

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[800px] mx-auto">
          <div className="text-[12px] text-[#9d9da8] mb-1">
            <Link href="/settings" className="hover:text-[#111113]">Settings</Link>
            <span className="mx-1.5">/</span>
            <span className="text-[#6b6b76]">Activity</span>
          </div>
          <h2 className="text-[20px] font-semibold text-[#111113] mb-1">Activity Log</h2>
          <p className="text-[13px] text-[#9d9da8] mb-6">Track all changes across your organization</p>

          {activity.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-[13px] text-[#9d9da8]">No activity recorded yet</p>
              <p className="text-[12px] text-[#c4c4cc] mt-1">Actions like creating clients, updating settings, and team changes will appear here.</p>
            </Card>
          ) : (
            <div className="space-y-6">
              {Array.from(grouped.entries()).map(([date, items]) => (
                <div key={date}>
                  <h3 className="text-[11px] font-medium text-[#9d9da8] uppercase tracking-wider mb-2">{date}</h3>
                  <Card>
                    <div className="divide-y divide-[#f4f4f6]">
                      {items.map((a: any) => {
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
                                <p className="text-[11px] text-[#9d9da8] mt-0.5">{typeof a.details === 'string' ? a.details : JSON.stringify(a.details)}</p>
                              )}
                            </div>
                            <span className="text-[11px] text-[#9d9da8] flex-shrink-0">
                              {formatRelative(a.created_at)}
                            </span>
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
      </PageWrapper>
    </>
  )
}
