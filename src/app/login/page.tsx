'use client'

import { useState, useEffect } from 'react'
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
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [resetSent, setResetSent] = useState(false)
  const [branding, setBranding] = useState<{ name: string; logo_url: string | null; primary_color: string; initials: string } | null>(null)

  useEffect(() => {
    fetch('/api/branding').then(r => r.ok ? r.json() : null).then(d => d && setBranding(d)).catch(() => {})
  }, [])

  const orgName = branding?.name || 'Agency'
  const orgColor = branding?.primary_color || '#2563eb'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { window.location.href = '/' }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=1`,
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setResetSent(true); setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#f8f8fa]">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={orgName} className="h-10 mx-auto mb-3 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-md mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: orgColor }}>
              <span className="text-white text-[20px] font-semibold">{branding?.initials || 'A'}</span>
            </div>
          )}
          <h1 className="text-[22px] font-semibold text-[#111113]">{orgName}</h1>
          <p className="text-[#9d9da8] text-[14px] mt-1">
            {mode === 'forgot' ? 'Reset your password' : 'Sign in to your account'}
          </p>
        </div>

        <div className="bg-white rounded-md border border-[#e8e8ec] p-6">
          {mode === 'forgot' ? (
            resetSent ? (
              <div className="text-center py-4">
                <div className="w-10 h-10 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"><path d="M5 10l3 3 7-7" /></svg>
                </div>
                <p className="text-[14px] font-medium text-[#111113]">Check your email</p>
                <p className="text-[13px] text-[#9d9da8] mt-1">We sent a reset link to {email}</p>
                <button onClick={() => { setMode('login'); setResetSent(false) }} className="mt-4 text-[13px] font-medium hover:underline" style={{ color: orgColor }}>
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-3">
                <input
                  type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[14px] focus:outline-none focus:border-[#2563eb] transition-colors"
                  autoComplete="email" required
                />
                {error && <p className="text-[#dc2626] text-[13px] text-center">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded text-white font-semibold text-[14px] disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: orgColor }}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button type="button" onClick={() => setMode('login')} className="w-full text-center text-[13px] text-[#9d9da8] hover:text-[#111113] mt-2">
                  Back to sign in
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[14px] focus:outline-none focus:border-[#2563eb] transition-colors"
                autoComplete="email" required
              />
              <input
                type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[14px] focus:outline-none focus:border-[#2563eb] transition-colors"
                autoComplete="current-password" required
              />
              {error && <p className="text-[#dc2626] text-[13px] text-center">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded text-white font-semibold text-[14px] disabled:opacity-50 transition-colors mt-1"
                style={{ backgroundColor: orgColor }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <button type="button" onClick={() => setMode('forgot')} className="w-full text-center text-[13px] text-[#9d9da8] hover:text-[#111113] mt-1">
                Forgot password?
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
