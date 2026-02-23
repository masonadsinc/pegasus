'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const ranges = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
]

export function DateRangePicker() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = Number(searchParams.get('days')) || 30

  const handleChange = (days: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (days === 30) params.delete('days')
    else params.set('days', String(days))
    router.push(`${pathname}${params.toString() ? '?' + params.toString() : ''}`)
  }

  return (
    <div className="flex items-center gap-1 bg-white border border-[#e8e8ec] rounded p-0.5">
      {ranges.map(r => (
        <button
          key={r.value}
          onClick={() => handleChange(r.value)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
            current === r.value
              ? 'bg-[#111113] text-white'
              : 'text-[#9d9da8] hover:bg-[#f4f4f6]'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
