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
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-9 w-36 rounded" />
            <div className="ml-auto flex gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <Skeleton className="h-1.5 w-full rounded-full mb-6" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-md bg-white border border-[#e8e8ec] px-5 py-4 flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
                <div className="ml-auto flex gap-2">
                  <Skeleton className="h-7 w-14 rounded" />
                  <Skeleton className="h-7 w-18 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
