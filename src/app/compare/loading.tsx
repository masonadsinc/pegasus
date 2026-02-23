import { Nav, PageWrapper } from '@/components/nav'

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-[#f4f4f6] rounded animate-pulse ${className}`} />
}

export default function CompareLoading() {
  return (
    <>
      <Nav current="compare" />
      <PageWrapper>
        <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72 mb-6" />
          <div className="rounded-md bg-white border border-[#e8e8ec] p-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-[#f4f4f6]">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16 ml-auto" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
