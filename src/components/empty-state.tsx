import Link from 'next/link'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <div className="bg-white border border-[#e8e8ec] rounded-md p-12 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-md bg-[#f4f4f6] flex items-center justify-center mx-auto mb-4 text-[#9d9da8]">
          {icon}
        </div>
      )}
      <h3 className="text-[14px] font-semibold text-[#111113]">{title}</h3>
      <p className="text-[12px] text-[#9d9da8] mt-1 max-w-sm mx-auto">{description}</p>
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link href={actionHref} className="inline-block mt-4 px-4 py-2 rounded-md bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] transition-colors">
            {actionLabel}
          </Link>
        ) : (
          <button onClick={onAction} className="mt-4 px-4 py-2 rounded-md bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] transition-colors">
            {actionLabel}
          </button>
        )
      )}
    </div>
  )
}
