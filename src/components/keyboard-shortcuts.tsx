'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function KeyboardShortcuts() {
  const router = useRouter()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Cmd/Ctrl + K → focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        if (searchInput) searchInput.focus()
      }

      // G then D → go to dashboard
      // G then C → go to clients
      // G then S → go to settings
      if (e.key === 'g') {
        const next = (e2: KeyboardEvent) => {
          if (e2.key === 'd') { e2.preventDefault(); router.push('/') }
          if (e2.key === 'c') { e2.preventDefault(); router.push('/clients') }
          if (e2.key === 's') { e2.preventDefault(); router.push('/settings') }
          window.removeEventListener('keydown', next)
        }
        window.addEventListener('keydown', next, { once: true })
        setTimeout(() => window.removeEventListener('keydown', next), 1000)
      }

      // ? → show help (just log for now)
      if (e.key === '?') {
        // Could show a modal, for now just a nice console message
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])

  return null
}
