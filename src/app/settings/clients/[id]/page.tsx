import { Nav } from '@/components/nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabaseAdmin } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClientEditForm } from './client-edit-form'
import { AccountEditor } from './account-editor'

const ORG_ID = process.env.ADSINC_ORG_ID!

async function getClient(id: string) {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select(`
      *,
      ad_accounts(*)
    `)
    .eq('org_id', ORG_ID)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data
}

export default async function ClientSettingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await getClient(id)
  if (!client) notFound()

  const accounts = (client.ad_accounts as any[]) || []

  return (
    <main className="min-h-screen pb-8">
      <Nav current="settings" />

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="text-xs text-zinc-500 mb-2">
          <Link href="/settings" className="hover:text-zinc-300">Settings</Link>
          <span className="mx-1">/</span>
          <Link href="/settings/clients" className="hover:text-zinc-300">Clients</Link>
          <span className="mx-1">/</span>
          <span className="text-zinc-300">{client.name}</span>
        </div>

        <h1 className="text-[20px] font-semibold mb-6">{client.name}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Details */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 mb-3">Client Details</h2>
            <Card className="p-4">
              <ClientEditForm client={client} />
            </Card>
          </div>

          {/* Ad Accounts */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 mb-3">Ad Accounts ({accounts.length})</h2>
            <div className="space-y-3">
              {accounts.map((acc: any) => (
                <Card key={acc.id} className="p-4">
                  <AccountEditor account={acc} />
                </Card>
              ))}
              {accounts.length === 0 && (
                <Card className="p-4">
                  <p className="text-sm text-zinc-500">No ad accounts connected</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
