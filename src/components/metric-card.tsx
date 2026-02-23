import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string
  subtext?: string
  change?: { label: string; positive: boolean }
  className?: string
}

export function MetricCard({ label, value, subtext, change, className }: MetricCardProps) {
  return (
    <div className={cn('rounded-md bg-white border border-[#e8e8ec] p-5', className)}>
      <p className="text-[11px] text-[#9d9da8] font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className="text-[24px] font-semibold tabular-nums text-[#111113]">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {subtext && <p className="text-[12px] text-[#9d9da8]">{subtext}</p>}
        {change && change.label !== '—' && (
          <span className={cn('text-[12px] font-medium', change.positive ? 'text-[#16a34a]' : 'text-[#dc2626]')}>
            {change.label}
          </span>
        )}
      </div>
    </div>
  )
}
