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
    <div className={cn('rounded-xl bg-zinc-900 border border-zinc-800 p-5', className)}>
      <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-white">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {subtext && <p className="text-[12px] text-zinc-500">{subtext}</p>}
        {change && change.label !== '—' && (
          <span className={cn('text-[12px] font-medium', change.positive ? 'text-emerald-400' : 'text-red-400')}>
            {change.label}
          </span>
        )}
      </div>
    </div>
  )
}
