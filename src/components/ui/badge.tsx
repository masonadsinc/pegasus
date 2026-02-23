import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'excellent' | 'good' | 'warning' | 'critical' | 'neutral'
}

const variants: Record<string, string> = {
  default: 'bg-zinc-800 text-zinc-300',
  excellent: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  good: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  critical: 'bg-red-500/15 text-red-400 border-red-500/20',
  neutral: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border', variants[variant], className)} {...props}>
      {children}
    </span>
  )
}
