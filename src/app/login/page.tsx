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
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#09090b]">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-lg font-bold">A</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Agency Command</h1>
          <p className="text-zinc-500 text-[13px] mt-1">Sign in to continue</p>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-[14px] text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              autoComplete="email" required
            />
            <input
              type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-[14px] text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              autoComplete="current-password" required
            />
            {error && <p className="text-red-400 text-[13px] text-center">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium text-[14px] hover:bg-blue-500 disabled:opacity-50 transition-colors mt-1">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
