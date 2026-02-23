import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'excellent' | 'good' | 'warning' | 'critical' | 'neutral' | 'onTarget' | 'attention' | 'noData'
}

const variants: Record<string, string> = {
  default: 'bg-[#f5f5f7] text-[#86868b]',
  excellent: 'bg-[#34c75920] text-[#248a3d]',
  good: 'bg-[#007aff20] text-[#0051a8]',
  warning: 'bg-[#ff950020] text-[#c75300]',
  critical: 'bg-[#ff3b3020] text-[#d70015]',
  neutral: 'bg-[#f5f5f7] text-[#86868b]',
  onTarget: 'bg-[#34c75920] text-[#248a3d]',
  attention: 'bg-[#ff3b3020] text-[#d70015]',
  noData: 'bg-[#f5f5f7] text-[#aeaeb2]',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full', variants[variant], className)} {...props}>
      {children}
    </span>
  )
}
