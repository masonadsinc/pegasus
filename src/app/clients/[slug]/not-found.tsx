import { Nav, PageWrapper } from '@/components/nav'
import Link from 'next/link'

export default function ClientNotFound() {
  return (
    <>
      <Nav current="clients" />
      <PageWrapper>
        <div className="p-6 max-w-[600px] mx-auto text-center mt-20">
          <div className="w-16 h-16 rounded-full bg-[#f4f4f6] flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9d9da8" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 15s1.5-2 4-2 4 2 4 2M9 9h.01M15 9h.01" />
            </svg>
          </div>
          <h2 className="text-[20px] font-semibold text-[#111113] mb-2">Client Not Found</h2>
          <p className="text-[13px] text-[#9d9da8] mb-6">This client doesn&apos;t exist or you don&apos;t have access to it.</p>
          <Link href="/clients" className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] text-white text-[13px] font-medium rounded hover:bg-[#333] transition-colors">
            ← Back to Clients
          </Link>
        </div>
      </PageWrapper>
    </>
  )
}
