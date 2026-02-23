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
    <div className={cn('rounded-xl bg-zinc-900 border border-zinc-800 p-4', className)}>
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold mt-0.5 tabular-nums">{value}</p>
      <div className="flex items-center gap-2 mt-0.5">
        {subtext && <p className="text-xs text-zinc-500">{subtext}</p>}
        {change && change.label !== '—' && (
          <span className={cn('text-xs font-medium', change.positive ? 'text-emerald-400' : 'text-red-400')}>
            {change.label}
          </span>
        )}
      </div>
    </div>
  )
}
