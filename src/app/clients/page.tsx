import { getDashboardData } from '@/lib/queries'
import { Nav, PageWrapper } from '@/components/nav'
import { ClientsGrid } from './clients-grid'

export const revalidate = 300
const ORG_ID = process.env.ADSINC_ORG_ID!

export default async function ClientsPage() {
  const accounts = await getDashboardData(ORG_ID, 30)

  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-6 max-w-[1400px] mx-auto">
          <div className="mb-2">
            <h2 className="text-xl font-bold text-[#111113]">Clients</h2>
            <p className="text-[13px] text-[#9d9da8]">All client accounts · Last 7 days</p>
          </div>
          <ClientsGrid accounts={accounts} />
        </div>
      </PageWrapper>
    </>
  )
}
