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
    .select(`id, name, slug, industry, status, monthly_retainer, rev_share_pct, contract_start, contract_end, primary_contact_name, primary_contact_email, website, notes, ad_accounts(id, name, platform_account_id, platform, objective, primary_action_type, target_cpl, target_roas, is_active)`)
    .eq('org_id', ORG_ID)
    .order('name')
  if (error) throw error
  return data || []
}

const statusVariant: Record<string, 'success' | 'info' | 'neutral' | 'danger'> = {
  active: 'success',
  pipeline: 'info',
  inactive: 'neutral',
  churned: 'danger',
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
        <div className="p-8 max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="text-[12px] text-zinc-500 mb-3 flex items-center gap-1.5">
                <Link href="/settings" className="hover:text-white transition-colors">Settings</Link>
                <span className="text-zinc-700">/</span>
                <span className="text-zinc-300">Clients</span>
              </div>
              <h1 className="text-2xl font-semibold text-white">Client Management</h1>
              <p className="text-sm text-zinc-500 mt-1">{clients.length} clients total</p>
            </div>
            <ClientActions />
          </div>

          {Object.entries(grouped).map(([status, group]) => group.length > 0 && (
            <div key={status} className="mb-8">
              <h2 className="text-sm font-medium text-zinc-400 mb-3 capitalize">{status} ({group.length})</h2>
              <div className="space-y-2">
                {group.map(client => (
                  <Link key={client.id} href={`/settings/clients/${client.id}`}>
                    <Card className="p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer mb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-[13px] font-medium text-white">{client.name}</h3>
                            <Badge variant={statusVariant[client.status || 'neutral'] || 'neutral'}>{client.status}</Badge>
                          </div>
                          <p className="text-[12px] text-zinc-500 mt-0.5">
                            {client.industry || 'No industry'}
                            {client.monthly_retainer ? ` · ${formatCurrency(client.monthly_retainer)}/mo` : ''}
                            {' · '}{(client.ad_accounts as any[])?.filter((a: any) => a.is_active).length || 0} active accounts
                          </p>
                        </div>
                        <span className="text-[12px] text-zinc-500">{client.primary_contact_email || 'No contact'}</span>
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
