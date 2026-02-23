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
    .select(`
      id, name, slug, industry, status, monthly_retainer, rev_share_pct,
      contract_start, contract_end, primary_contact_name, primary_contact_email, website, notes,
      ad_accounts(id, name, platform_account_id, platform, objective, primary_action_type, target_cpl, target_roas, is_active)
    `)
    .eq('org_id', ORG_ID)
    .order('name')

  if (error) throw error
  return data || []
}

const statusVariant: Record<string, 'excellent' | 'good' | 'warning' | 'critical' | 'neutral'> = {
  active: 'excellent',
  pipeline: 'good',
  inactive: 'neutral',
  churned: 'critical',
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
    <><PageWrapper><main className="pb-8">
      <Nav current="settings" />

      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs text-[#86868b]500 mb-1">
              <Link href="/settings" className="hover:text-[#86868b]300">Settings</Link>
              <span className="mx-1">/</span>
              <span className="text-[#86868b]300">Clients</span>
            </div>
            <h1 className="text-xl font-bold">Client Management</h1>
            <p className="text-sm text-[#86868b]500">{clients.length} clients total</p>
          </div>
          <ClientActions />
        </div>

        {Object.entries(grouped).map(([status, group]) => group.length > 0 && (
          <div key={status} className="mb-8">
            <h2 className="text-sm font-semibold text-[#86868b]400 mb-3 capitalize">{status} ({group.length})</h2>
            <div className="space-y-2">
              {group.map(client => (
                <Link key={client.id} href={`/settings/clients/${client.id}`}>
                  <Card className="p-4 hover:bg-[#f5f5f7]/50 transition-colors cursor-pointer mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm">{client.name}</h3>
                            <Badge variant={statusVariant[client.status || 'neutral']}>{client.status}</Badge>
                          </div>
                          <p className="text-xs text-[#86868b]500 mt-0.5">
                            {client.industry || 'No industry'}
                            {client.monthly_retainer ? ` · ${formatCurrency(client.monthly_retainer)}/mo` : ''}
                            {' · '}{(client.ad_accounts as any[])?.filter((a: any) => a.is_active).length || 0} active accounts
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-[#86868b]500">
                        {client.primary_contact_email || 'No contact'}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main></PageWrapper></>
  )
}
