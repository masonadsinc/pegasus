import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

const variants: Record<string, string> = {
  default: 'bg-[#f4f4f6] text-[#6b6b76]',
  success: 'bg-[#dcfce7] text-[#15803d]',
  warning: 'bg-[#fff7ed] text-[#c2410c]',
  danger: 'bg-[#fef2f2] text-[#dc2626]',
  info: 'bg-[#eff6ff] text-[#2563eb]',
  neutral: 'bg-[#f4f4f6] text-[#9d9da8]',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md', variants[variant], className)} {...props}>
      {children}
    </span>
  )
}
