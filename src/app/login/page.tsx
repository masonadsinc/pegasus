'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { window.location.href = '/' }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#f8f8fa]">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <h1 className="text-[22px] font-semibold text-[#111113]">Ads.Inc</h1>
          <p className="text-[#9d9da8] text-[14px] mt-1">Agency Command</p>
        </div>

        <div className="bg-white rounded-md border border-[#e8e8ec] p-6">
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[14px] focus:outline-none focus:border-[#2563eb] transition-colors"
              autoComplete="email" required
            />
            <input
              type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[14px] focus:outline-none focus:border-[#2563eb] transition-colors"
              autoComplete="current-password" required
            />
            {error && <p className="text-[#dc2626] text-[13px] text-center">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded bg-[#2563eb] text-white font-semibold text-[14px] hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors mt-1">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
