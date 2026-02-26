'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

function IconGrid({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4z" opacity=".8" /><path d="M16 4h0m0 6h0m0 6h0M4 16h4v0H4zm6 0h4v0h-4z" /></svg>
}

function IconClients({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 14.5v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1" />
      <circle cx="8.5" cy="6.5" r="2.5" />
      <path d="M16 14.5v-1a3 3 0 0 0-2.25-2.9" />
      <path d="M13.5 4.1a2.5 2.5 0 0 1 0 4.8" />
    </svg>
  )
}

function IconReport({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M7 13V9m3 4V7m3 6v-3" />
    </svg>
  )
}

function IconInsights({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 15l4-4 3 2 7-8" />
      <path d="M14 5h3v3" />
    </svg>
  )
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.5v2m0 11v2m-5.3-13.8l1.4 1.4m7.8 7.8l1.4 1.4M2.5 10h2m11 0h2M4.7 15.3l1.4-1.4m7.8-7.8l1.4-1.4" />
    </svg>
  )
}

function IconPegasus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2L3 6l7 4 7-4-7-4zM3 14l7 4 7-4M3 10l7 4 7-4" />
    </svg>
  )
}

function IconBrush({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.5 3.5l1 1-6.5 6.5-2 .5.5-2 6.5-6.5z" />
      <path d="M8 4H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

function IconPen({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" />
      <path d="M11 6l3 3" />
    </svg>
  )
}

function IconLibrary({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="5" rx="1" />
      <rect x="12" y="3" width="5" height="5" rx="1" />
      <rect x="3" y="12" width="5" height="5" rx="1" />
      <rect x="12" y="12" width="5" height="5" rx="1" />
    </svg>
  )
}

export type NavPage = 'dashboard' | 'clients' | 'reports' | 'pegasus' | 'creative-studio' | 'copywriter' | 'ad-library' | 'settings'

export function Nav({ current }: { current: NavPage }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [branding, setBranding] = useState<{ name: string; logo_url: string | null; primary_color: string; initials: string } | null>(null)

  useEffect(() => {
    fetch('/api/branding').then(r => r.ok ? r.json() : null).then(d => d && setBranding(d)).catch(() => {})
  }, [])

  const orgName = branding?.name || 'Agency'
  const orgInitial = branding?.initials || 'A'
  const orgColor = branding?.primary_color || '#dc2626'

  const sections = [
    {
      label: null, // No label for top section
      links: [
        { href: '/pegasus', label: 'Pegasus AI', icon: IconPegasus, key: 'pegasus' as const },
      ],
    },
    {
      label: 'MANAGE',
      links: [
        { href: '/', label: 'Health Tracker', icon: IconGrid, key: 'dashboard' as const },
        { href: '/clients', label: 'Clients', icon: IconClients, key: 'clients' as const },
        { href: '/reports', label: 'Reports', icon: IconReport, key: 'reports' as const },
      ],
    },
    {
      label: 'CREATE',
      links: [
        { href: '/creative-studio', label: 'Image Studio', icon: IconBrush, key: 'creative-studio' as const },
        { href: '/copywriter', label: 'Copywriter', icon: IconPen, key: 'copywriter' as const },
        { href: '/ad-library', label: 'Ad Library', icon: IconLibrary, key: 'ad-library' as const },
      ],
    },
  ]

  const sidebarContent = (
    <>
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#f4f4f6]">
        <div className="flex items-center gap-2.5">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={orgName} className="w-7 h-7 rounded object-contain" />
          ) : (
            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: orgColor }}>
              <span className="text-white text-[12px] font-semibold">{orgInitial}</span>
            </div>
          )}
          <div>
            <h1 className="text-[14px] font-semibold text-[#111113] tracking-tight leading-none">{orgName}</h1>
            <p className="text-[10px] text-[#9d9da8] leading-none mt-0.5">Ad Management</p>
          </div>
        </div>
        <button className="lg:hidden p-1 rounded-md hover:bg-[#f4f4f6]" onClick={() => setMobileOpen(false)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#9d9da8" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>

      <nav className="flex-1 px-3 pt-1">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-4' : ''}>
            {section.label && (
              <p className="text-[9px] uppercase tracking-[0.1em] text-[#c4c4cc] font-semibold px-3 mb-1">{section.label}</p>
            )}
            {section.links.map(l => (
              <Link
                key={l.key}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium mb-0.5 transition-all duration-150 ${
                  current === l.key
                    ? 'bg-[#111113] text-white'
                    : 'text-[#6b6b76] hover:text-[#111113] hover:bg-[#f4f4f6]'
                }`}
              >
                <l.icon className="w-[16px] h-[16px]" />
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-[#e8e8ec]">
        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium transition-colors ${
            current === 'settings'
              ? 'bg-[#111113] text-white'
              : 'text-[#9d9da8] hover:text-[#111113] hover:bg-[#f4f4f6]'
          }`}
        >
          <IconSettings className="w-[16px] h-[16px]" />
          Settings
        </Link>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 p-2 rounded bg-white border border-[#e8e8ec] shadow-sm"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#111113" strokeWidth="2" strokeLinecap="round"><path d="M3 5h12M3 9h12M3 13h12" /></svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — always visible on lg+, slide-in on mobile */}
      <aside className={`fixed left-0 top-0 bottom-0 w-[200px] bg-white border-r border-[#e8e8ec] flex flex-col z-50 transition-transform duration-200 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {sidebarContent}
      </aside>
    </>
  )
}

function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ clients: any[]; ads: any[] } | null>(null)
  const [open, setOpen] = useState(false)

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const input = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        if (input) input.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults(null); return }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => { setResults(d); setOpen(true) })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9d9da8] pointer-events-none" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#c4c4cc] bg-white border border-[#e8e8ec] rounded px-1.5 py-0.5 pointer-events-none font-mono">⌘K</kbd>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur() } }}
        onFocus={() => results && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Search clients & ads..."
        className="pl-9 pr-16 py-1.5 text-[13px] bg-[#f4f4f6] border border-[#e8e8ec] rounded w-[280px] focus:outline-none focus:border-[#2563eb] focus:bg-white focus:w-[360px] transition-all placeholder-[#9d9da8]"
      />
      {open && results && (results.clients.length > 0 || results.ads.length > 0) && (
        <div className="absolute top-full mt-1 left-0 w-[360px] bg-white border border-[#e8e8ec] rounded shadow-lg overflow-hidden z-50">
          {results.clients.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider px-2 mb-1">Clients</p>
              {results.clients.map(c => (
                <a key={c.slug} href={`/clients/${c.slug}`} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#f4f4f6] text-[13px] font-medium text-[#111113]">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9d9da8" strokeWidth="1.5"><circle cx="10" cy="7" r="3" /><path d="M4 17v-1a6 6 0 0112 0v1" /></svg>
                  {c.name}
                </a>
              ))}
            </div>
          )}
          {results.ads.length > 0 && (
            <div className="p-2 border-t border-[#f4f4f6]">
              <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider px-2 mb-1">Ads</p>
              {results.ads.map(a => (
                <a key={a.id} href={a.clientSlug ? `/clients/${a.clientSlug}` : '#'} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#f4f4f6]">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9d9da8" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M7 10h6" /></svg>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-[#111113] truncate">{a.name}</p>
                    {a.headline && <p className="text-[11px] text-[#9d9da8] truncate">{a.headline}</p>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<{ email?: string; display_name?: string; role?: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d)).catch(() => {})
  }, [])

  const initial = (user?.display_name || user?.email || '?')[0].toUpperCase()

  async function handleLogout() {
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <div className="w-6 h-6 rounded bg-[#111113] flex items-center justify-center">
          <span className="text-white text-[10px] font-semibold">{initial}</span>
        </div>
        <span className="text-[12px] font-medium text-[#6b6b76]">{user?.display_name || user?.email?.split('@')[0] || '...'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#e8e8ec] rounded shadow-lg z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#f4f4f6]">
              <p className="text-[12px] font-medium text-[#111113]">{user?.display_name || user?.email}</p>
              <p className="text-[11px] text-[#9d9da8]">{user?.role || 'Member'}</p>
            </div>
            <a href="/settings" className="block px-4 py-2 text-[12px] text-[#6b6b76] hover:bg-[#f4f4f6]">Settings</a>
            <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-[12px] text-[#dc2626] hover:bg-[#fef2f2]">Sign Out</button>
          </div>
        </>
      )}
    </div>
  )
}

export function TopBar() {
  return (
    <div className="h-11 border-b border-[#e8e8ec] bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <GlobalSearch />
      </div>
      <UserMenu />
    </div>
  )
}

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:ml-[200px] min-h-screen">
      <TopBar />
      {children}
    </div>
  )
}
