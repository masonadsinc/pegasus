import { Nav, PageWrapper } from '@/components/nav'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#e8e8ec] rounded-lg ${className}`} />
}

export default function DashboardLoading() {
  return (
    <>
      <Nav current="dashboard" />
      <PageWrapper>
        <div className="p-6 max-w-[1200px] mx-auto">
          <Skeleton className="h-7 w-40 mb-1" />
          <Skeleton className="h-4 w-60 mb-6" />

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-xl bg-white border border-[#e8e8ec] p-5">
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-white border border-[#e8e8ec]">
            <div className="px-5 py-4 border-b border-[#e8e8ec]">
              <Skeleton className="h-4 w-28" />
            </div>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-[#f4f4f6]">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-[28px] w-[80px]" />
              </div>
            ))}
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
