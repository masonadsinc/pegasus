import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

const variants: Record<string, string> = {
  default: 'bg-zinc-800 text-zinc-400',
  success: 'bg-emerald-500/10 text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-400',
  danger: 'bg-red-500/10 text-red-400',
  info: 'bg-blue-500/10 text-blue-400',
  neutral: 'bg-zinc-800 text-zinc-500',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md', variants[variant], className)} {...props}>
      {children}
    </span>
  )
}
