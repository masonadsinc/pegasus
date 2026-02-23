'use client'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#f8f8fa]">
      <div className="text-center max-w-sm">
        <p className="text-[48px] font-semibold text-[#fecaca] leading-none mb-4">Error</p>
        <h1 className="text-[20px] font-semibold text-[#111113] mb-2">Something went wrong</h1>
        <p className="text-[13px] text-[#9d9da8] mb-6">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="px-5 py-2.5 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] transition-colors">
            Try Again
          </button>
          <a href="/" className="px-5 py-2.5 rounded border border-[#e8e8ec] text-[#6b6b76] text-[13px] font-medium hover:bg-[#f4f4f6] transition-colors">
            Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
