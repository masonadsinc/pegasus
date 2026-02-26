export function DataFreshness({ timezone = 'America/Los_Angeles' }: { timezone?: string }) {
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  local.setDate(local.getDate() - 1)
  const yesterday = local.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-[#9d9da8]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
      Data through {yesterday}
    </div>
  )
}
