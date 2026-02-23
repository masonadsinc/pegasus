import Link from 'next/link'

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}

function IconClients({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function Nav({ current }: { current: 'dashboard' | 'clients' | 'financials' | 'settings' }) {
  const links = [
    { href: '/', label: 'Dashboard', icon: IconDashboard, key: 'dashboard' as const },
    { href: '/clients', label: 'Clients', icon: IconClients, key: 'clients' as const },
  ]

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-[#0f0f12] border-r border-[#1c1c21] flex flex-col z-20">
      <div className="px-5 py-5 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Agency Command</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Ads.Inc</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3">
        <p className="px-3 mb-2 text-[10px] font-medium text-zinc-600 uppercase tracking-widest">Overview</p>
        {links.map(l => (
          <Link
            key={l.key}
            href={l.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-colors ${
              current === l.key
                ? 'bg-zinc-800/80 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
            }`}
          >
            <l.icon className="w-4 h-4" />
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-[#1c1c21]">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
            current === 'settings'
              ? 'bg-zinc-800/80 text-white'
              : 'text-zinc-500 hover:text-white hover:bg-zinc-800/40'
          }`}
        >
          <IconSettings className="w-4 h-4" />
          Settings
        </Link>
      </div>
    </aside>
  )
}

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return <div className="ml-[220px] min-h-screen bg-[#09090b]">{children}</div>
}
