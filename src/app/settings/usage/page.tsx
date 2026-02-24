import { Nav, PageWrapper } from '@/components/nav'
import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { UsageDashboard } from './usage-dashboard'

export const revalidate = 0

export default async function UsagePage() {
  const user = await getUser()
  if (!user) redirect('/login')

  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <UsageDashboard />
      </PageWrapper>
    </>
  )
}
