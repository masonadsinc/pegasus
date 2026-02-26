import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabaseAdmin } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClientEditForm } from './client-edit-form'
import { AccountEditor } from './account-editor'
import { PortalManager } from './portal-manager'

const ORG_ID = process.env.ADSINC_ORG_ID!

async function getClient(id: string) {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*, ad_accounts(*)')
    .eq('org_id', ORG_ID)
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}

async function getActivity(clientId: string) {
  const { data } = await supabaseAdmin
    .from('activity_log')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20)
  return data || []
}

export default async function ClientSettingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await getClient(id)
  if (!client) notFound()

  const accounts = (client.ad_accounts as any[]) || []
  const activity = await getActivity(client.id)

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[1000px] mx-auto">
          {/* Breadcrumb */}
          <div className="text-[12px] text-[#9d9da8] mb-2">
            <Link href="/settings" className="hover:text-[#111113]">Settings</Link>
            <span className="mx-1.5">/</span>
            <Link href="/settings/clients" className="hover:text-[#111113]">Clients</Link>
            <span className="mx-1.5">/</span>
            <span className="text-[#6b6b76]">{client.name}</span>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-[20px] font-semibold text-[#111113]">{client.name}</h1>
            <Badge variant={client.status === 'active' ? 'success' : client.status === 'churned' ? 'danger' : client.status === 'pipeline' ? 'info' : 'neutral'}>{client.status}</Badge>
          </div>

          <div className="space-y-6">
            {/* Client Form */}
            <Card className="p-6">
              <ClientEditForm client={client} />
            </Card>

            {/* Client Portal */}
            <Card className="p-6">
              <PortalManager clientId={client.id} initialToken={client.portal_token} />
            </Card>

            {/* Ad Accounts */}
            <div>
              <h2 className="text-[13px] font-semibold text-[#9d9da8] mb-3">Ad Accounts ({accounts.length})</h2>
              <div className="space-y-3">
                {accounts.map((acc: any) => (
                  <Card key={acc.id} className="p-5">
                    <AccountEditor account={acc} />
                  </Card>
                ))}
                {accounts.length === 0 && (
                  <Card className="p-5">
                    <p className="text-[13px] text-[#9d9da8]">No ad accounts connected to this client.</p>
                    <p className="text-[12px] text-[#c4c4cc] mt-1">Ad accounts are linked during the Meta sync process.</p>
                  </Card>
                )}
              </div>
            </div>

            {/* Activity Log */}
            <div>
              <h2 className="text-[13px] font-semibold text-[#9d9da8] mb-3">Activity Log</h2>
              <Card>
                {activity.length > 0 ? (
                  <div className="divide-y divide-[#f4f4f6]">
                    {activity.map((a: any) => (
                      <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-[12px] text-[#111113]">
                            <span className="font-medium">{a.actor_name || 'System'}</span>
                            {' '}{a.action}{' '}
                            {a.target_name && <span className="text-[#6b6b76]">{a.target_name}</span>}
                          </p>
                          {a.details && <p className="text-[11px] text-[#9d9da8] mt-0.5">{typeof a.details === 'string' ? a.details : JSON.stringify(a.details)}</p>}
                        </div>
                        <span className="text-[11px] text-[#9d9da8] flex-shrink-0 ml-4">
                          {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center">
                    <p className="text-[13px] text-[#9d9da8]">No activity recorded yet</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
