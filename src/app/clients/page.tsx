import { getDashboardData } from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'
import { Nav, PageWrapper } from '@/components/nav'
import { ClientsGrid } from './clients-grid'
import { getOrgId } from '@/lib/org'

export const revalidate = 300
const ORG_ID = await getOrgId()

export default async function ClientsPage() {
  const accounts = await getDashboardData(ORG_ID, 7)
  const totalSpend = accounts.reduce((s, a) => s + a.spend, 0)
  const activeCount = accounts.filter(a => a.spend > 0).length

  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-6 max-w-[1400px] mx-auto">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-[20px] font-semibold text-[#111113]">Clients</h2>
              <p className="text-[13px] text-[#9d9da8]">{accounts.length} accounts · {activeCount} active · {formatCurrency(totalSpend)} total spend (7d)</p>
            </div>
          </div>
          <ClientsGrid accounts={accounts} />
        </div>
      </PageWrapper>
    </>
  )
}
