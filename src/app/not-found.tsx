import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#f8f8fa]">
      <div className="text-center max-w-sm">
        <p className="text-[64px] font-semibold text-[#e8e8ec] leading-none mb-4">404</p>
        <h1 className="text-[20px] font-semibold text-[#111113] mb-2">Page not found</h1>
        <p className="text-[13px] text-[#9d9da8] mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/" className="inline-flex px-5 py-2.5 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] transition-colors">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
