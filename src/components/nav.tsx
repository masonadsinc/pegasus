'use client'

import { useState } from 'react'
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

export function Nav({ current }: { current: 'dashboard' | 'clients' | 'reports' | 'insights' | 'settings' }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = [
    { href: '/', label: 'Health Tracker', icon: IconGrid, key: 'dashboard' as const },
    { href: '/clients', label: 'Clients', icon: IconClients, key: 'clients' as const },
    { href: '#', label: 'Reports', icon: IconReport, key: 'reports' as const },
    { href: '#', label: 'Insights', icon: IconInsights, key: 'insights' as const },
  ]

  const sidebarContent = (
    <>
      <div className="px-5 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#111113] tracking-tight">Ads.Inc</h1>
        <button className="lg:hidden p-1 rounded-md hover:bg-[#f4f4f6]" onClick={() => setMobileOpen(false)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#9d9da8" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>

      <nav className="flex-1 px-3">
        {links.map(l => (
          <Link
            key={l.key}
            href={l.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-colors ${
              current === l.key
                ? 'bg-[#dc2626] text-white'
                : 'text-[#6b6b76] hover:text-[#111113] hover:bg-[#f4f4f6]'
            }`}
          >
            <l.icon className="w-[16px] h-[16px]" />
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-[#e8e8ec]">
        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
            current === 'settings'
              ? 'bg-[#dc2626] text-white'
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
        className="lg:hidden fixed top-3 left-3 z-30 p-2 rounded-lg bg-white border border-[#e8e8ec] shadow-sm"
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

export function TopBar() {
  const now = new Date()
  const timeStr = now.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' }) + ' PST'

  return (
    <div className="h-12 border-b border-[#e8e8ec] bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9d9da8]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
          <input placeholder="Search..." className="pl-9 pr-4 py-1.5 text-[13px] bg-[#f4f4f6] border border-[#e8e8ec] rounded-lg w-[200px] focus:outline-none focus:border-[#2563eb] placeholder-[#9d9da8]" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-[#9d9da8] tabular-nums">{timeStr}</span>
        <div className="w-7 h-7 rounded-full bg-[#dc2626] flex items-center justify-center">
          <span className="text-white text-[11px] font-semibold">M</span>
        </div>
        <span className="text-[13px] font-medium text-[#6b6b76]">mason</span>
      </div>
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
