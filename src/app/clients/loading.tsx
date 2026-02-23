import { Nav, PageWrapper } from '@/components/nav'

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-[#f4f4f6] rounded animate-pulse ${className}`} />
}

export default function ClientsLoading() {
  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-4 w-56 mb-6" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="rounded-md bg-white border border-[#e8e8ec] p-5">
                <Skeleton className="h-2 w-full mb-4" />
                <Skeleton className="h-5 w-28 mb-3" />
                <Skeleton className="h-1.5 w-full mb-4" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-full mb-3" />
                <div className="pt-3 border-t border-[#f4f4f6]">
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
