import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabaseAdmin } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { ClientActions } from './client-actions'
import { getOrgId } from '@/lib/org'

export const revalidate = 30
const ORG_ID = await getOrgId()

async function getClients() {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select(`id, name, slug, industry, status, location, monthly_retainer, primary_contact_name, primary_contact_email, business_description, target_audience, ad_accounts(id, is_active)`)
    .eq('org_id', ORG_ID)
    .order('name')
  if (error) throw error
  return data || []
}

const statusVariant: Record<string, 'success' | 'info' | 'neutral' | 'danger'> = {
  active: 'success', pipeline: 'info', inactive: 'neutral', churned: 'danger',
}

function completionPct(client: any): number {
  const fields = ['industry', 'location', 'monthly_retainer', 'primary_contact_name', 'primary_contact_email', 'business_description', 'target_audience']
  const filled = fields.filter(f => client[f]).length
  return Math.round((filled / fields.length) * 100)
}

export default async function ClientsSettingsPage() {
  const clients = await getClients()
  const grouped = {
    active: clients.filter(c => c.status === 'active'),
    pipeline: clients.filter(c => c.status === 'pipeline'),
    inactive: clients.filter(c => c.status === 'inactive'),
    churned: clients.filter(c => c.status === 'churned'),
  }

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[1000px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[12px] text-[#9d9da8] mb-1">
                <Link href="/settings" className="hover:text-[#111113]">Settings</Link>
                <span className="mx-1.5">/</span>
                <span className="text-[#6b6b76]">Clients</span>
              </div>
              <h2 className="text-[20px] font-semibold text-[#111113]">Client Management</h2>
              <p className="text-[13px] text-[#9d9da8]">{clients.length} clients total</p>
            </div>
            <ClientActions />
          </div>

          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Object.entries(grouped).map(([status, group]) => (
              <div key={status} className="px-4 py-3 rounded bg-[#fafafb] border border-[#e8e8ec]">
                <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider font-medium">{status}</p>
                <p className="text-[18px] font-semibold text-[#111113] mt-0.5">{group.length}</p>
              </div>
            ))}
          </div>

          {Object.entries(grouped).map(([status, group]) => group.length > 0 && (
            <div key={status} className="mb-6">
              <h3 className="text-[10px] font-medium text-[#9d9da8] uppercase tracking-wider mb-2">{status} ({group.length})</h3>
              <div className="space-y-2">
                {group.map(client => {
                  const pct = completionPct(client)
                  const activeAccounts = (client.ad_accounts as any[])?.filter((a: any) => a.is_active).length || 0

                  return (
                    <Link key={client.id} href={`/settings/clients/${client.id}`}>
                      <Card className="p-4 hover:bg-[#fafafb] transition-colors cursor-pointer mb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-[13px] font-medium text-[#111113]">{client.name}</h4>
                              <Badge variant={statusVariant[client.status || 'neutral'] || 'neutral'}>{client.status}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-[12px] text-[#9d9da8]">
                              {client.industry && <span>{client.industry}</span>}
                              {client.location && <span>{client.location}</span>}
                              {client.monthly_retainer && <span>{formatCurrency(client.monthly_retainer)}/mo</span>}
                              <span>{activeAccounts} account{activeAccounts !== 1 ? 's' : ''}</span>
                            </div>
                            {client.business_description && (
                              <p className="text-[11px] text-[#9d9da8] mt-1 line-clamp-1">{client.business_description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                            {client.primary_contact_name && (
                              <span className="text-[11px] text-[#9d9da8]">{client.primary_contact_name}</span>
                            )}
                            <div className="flex items-center gap-1.5" title={`Profile ${pct}% complete`}>
                              <div className="w-16 h-1 rounded-full bg-[#e8e8ec] overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-[#16a34a]' : pct >= 50 ? 'bg-[#2563eb]' : 'bg-[#f59e0b]'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-[#9d9da8]">{pct}%</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </PageWrapper>
    </>
  )
}
