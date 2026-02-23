import { Nav, PageWrapper } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabaseAdmin } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { ClientActions } from './client-actions'

export const revalidate = 30
const ORG_ID = process.env.ADSINC_ORG_ID!

async function getClients() {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select(`id, name, slug, industry, status, monthly_retainer, primary_contact_email, ad_accounts(id, is_active)`)
    .eq('org_id', ORG_ID)
    .order('name')
  if (error) throw error
  return data || []
}

const statusVariant: Record<string, 'success' | 'info' | 'neutral' | 'danger'> = {
  active: 'success', pipeline: 'info', inactive: 'neutral', churned: 'danger',
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

          {Object.entries(grouped).map(([status, group]) => group.length > 0 && (
            <div key={status} className="mb-6">
              <h3 className="text-[13px] font-semibold text-[#9d9da8] mb-2 capitalize">{status} ({group.length})</h3>
              <div className="space-y-2">
                {group.map(client => (
                  <Link key={client.id} href={`/settings/clients/${client.id}`}>
                    <Card className="p-4 hover:bg-[#fafafb] transition-colors cursor-pointer mb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-medium">{client.name}</h4>
                            <Badge variant={statusVariant[client.status || 'neutral'] || 'neutral'}>{client.status}</Badge>
                          </div>
                          <p className="text-[12px] text-[#9d9da8] mt-0.5">
                            {client.industry || 'No industry'}
                            {client.monthly_retainer ? ` · ${formatCurrency(client.monthly_retainer)}/mo` : ''}
                            {' · '}{(client.ad_accounts as any[])?.filter((a: any) => a.is_active).length || 0} accounts
                          </p>
                        </div>
                        <span className="text-[12px] text-[#9d9da8]">{client.primary_contact_email || ''}</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PageWrapper>
    </>
  )
}
