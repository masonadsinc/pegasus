import { Nav, PageWrapper } from '@/components/nav'

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-[#f4f4f6] rounded animate-pulse ${className}`} />
}

export default function DashboardLoading() {
  return (
    <>
      <Nav current="dashboard" />
      <PageWrapper>
        <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-md bg-white border border-[#e8e8ec] p-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-7 w-24" />
              </div>
            ))}
          </div>

          <div className="rounded-md bg-white border border-[#e8e8ec] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e8e8ec]">
              <Skeleton className="h-4 w-28" />
            </div>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="px-5 py-4 border-b border-[#f4f4f6] flex items-center gap-4">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16 ml-auto" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
