import Link from 'next/link'

export function Nav({ current }: { current: 'dashboard' | 'clients' | 'financials' | 'settings' }) {
  const links = [
    { href: '/', label: 'Health Tracker', icon: '📊', key: 'dashboard' as const },
    { href: '/clients', label: 'Clients', icon: '👥', key: 'clients' as const },
    { href: '/settings', label: 'Settings', icon: '⚙️', key: 'settings' as const },
  ]

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[200px] bg-white border-r border-[#e5e5e5] flex flex-col z-20">
      <div className="p-5 pb-3">
        <h1 className="text-lg font-bold text-[#1d1d1f]">Ads.Inc</h1>
      </div>
      <nav className="flex-1 px-3">
        {links.map(l => (
          <Link
            key={l.key}
            href={l.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-colors ${
              current === l.key
                ? 'bg-[#ff3b30] text-white'
                : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
            }`}
          >
            <span className="text-sm">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-[#e5e5e5]">
        <Link href="/settings" className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-[#86868b] hover:bg-[#f5f5f7]">
          <span>⚙️</span> Settings
        </Link>
      </div>
    </aside>
  )
}

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return <div className="ml-[200px] min-h-screen">{children}</div>
}
