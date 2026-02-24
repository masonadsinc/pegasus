'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const OPTIONS = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '60d', value: 60 },
  { label: '90d', value: 90 },
]

export function PortalDatePicker({ currentDays }: { currentDays: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setDays(d: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (d === 30) {
      params.delete('days')
    } else {
      params.set('days', String(d))
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex items-center border border-[#e8e8ec] rounded overflow-hidden">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => setDays(opt.value)}
          className={`px-2.5 py-1 text-[11px] font-medium border-r border-[#e8e8ec] last:border-r-0 transition-colors ${
            currentDays === opt.value
              ? 'bg-[#111113] text-white'
              : 'bg-white text-[#9d9da8] hover:text-[#111113]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
