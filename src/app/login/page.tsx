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
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#f5f5f7]">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <h1 className="text-[28px] font-bold text-[#1d1d1f]">Ads.Inc</h1>
          <p className="text-[#86868b] text-[14px] mt-1">Agency Command</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e5e5e5] p-6 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5e5] text-[14px] focus:outline-none focus:border-[#007aff] transition-colors"
              autoComplete="email" required
            />
            <input
              type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5e5] text-[14px] focus:outline-none focus:border-[#007aff] transition-colors"
              autoComplete="current-password" required
            />
            {error && <p className="text-[#ff3b30] text-[13px] text-center">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-[#007aff] text-white font-semibold text-[14px] hover:bg-[#0051a8] disabled:opacity-50 transition-colors mt-1">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
