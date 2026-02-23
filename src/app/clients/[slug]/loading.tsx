import { Nav, PageWrapper } from '@/components/nav'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#e8e8ec] rounded-lg ${className}`} />
}

export default function ClientLoading() {
  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-6 max-w-[1200px] mx-auto">
          {/* Breadcrumb */}
          <Skeleton className="h-4 w-48 mb-4" />

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <Skeleton className="h-7 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-16 rounded-full" />
              <Skeleton className="h-7 w-60" />
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl bg-white border border-[#e8e8ec] p-5">
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>

          {/* Tabs */}
          <Skeleton className="h-10 w-full mb-4" />

          {/* Content */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl bg-white border border-[#e8e8ec] p-4">
                <Skeleton className="h-3 w-14 mb-2" />
                <Skeleton className="h-6 w-20 mb-1" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-[#e8e8ec] p-5">
              <Skeleton className="h-4 w-32 mb-4" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 mb-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-40 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-white border border-[#e8e8ec] p-5">
              <Skeleton className="h-4 w-32 mb-4" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 mb-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-40 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
