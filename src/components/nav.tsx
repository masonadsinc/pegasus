import Link from 'next/link'

export function Nav({ current }: { current: 'dashboard' | 'clients' | 'financials' | 'settings' }) {
  const links = [
    { href: '/', label: '🐎 Command', key: 'dashboard' as const },
    { href: '/clients', label: 'Clients', key: 'clients' as const },
    { href: '/financials', label: 'Financials', key: 'financials' as const },
  ]

  return (
    <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-6 h-12">
        {links.map(l => (
          <Link
            key={l.key}
            href={l.href}
            className={`text-sm font-medium transition-colors ${current === l.key ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
