import { Nav, PageWrapper } from '@/components/nav'

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-[#f4f4f6] rounded animate-pulse ${className}`} />
}

export default function ReportsLoading() {
  return (
    <>
      <Nav current="reports" />
      <PageWrapper>
        <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-4 w-56 mb-6" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-md bg-white border border-[#e8e8ec] p-4">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
          <div className="rounded-md bg-white border border-[#e8e8ec] overflow-hidden">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="px-5 py-4 border-b border-[#f4f4f6] flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
                <div className="ml-auto flex gap-2">
                  <Skeleton className="h-7 w-16 rounded" />
                  <Skeleton className="h-7 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
