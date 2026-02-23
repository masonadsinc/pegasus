import { Nav, PageWrapper } from '@/components/nav'

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-[#f4f4f6] rounded animate-pulse ${className}`} />
}

export default function SettingsLoading() {
  return (
    <>
      <Nav current="settings" />
      <PageWrapper>
        <div className="p-6 max-w-[1000px] mx-auto">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48 mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-md bg-white border border-[#e8e8ec] p-5">
                <Skeleton className="h-9 w-9 rounded mb-3" />
                <Skeleton className="h-4 w-20 mb-1.5" />
                <Skeleton className="h-3 w-36" />
              </div>
            ))}
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
