import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthenContext'

export default function Login() {
  const { session, loading, signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    if (mode === 'signup' && !email.trim()) {
      setError('Enter an email address.')
      return
    }
    setSubmitting(true)
    const result = mode === 'signin'
      ? await signIn(username.trim(), password)
      : await signUp(username.trim(), email.trim(), password)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }
    if (mode === 'signup') {
      setInfo('Account created. Check your email to confirm, then sign in.')
      setMode('signin')
    }
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    const result = await signInWithGoogle()
    if (result.error) {
      setError(result.error)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-11 h-11 rounded-lg bg-primary-600 flex items-center justify-center text-white mb-3">
            <CrossIcon />
          </div>
          <h1 className="text-xl font-bold text-slate-800">MediRemind</h1>
          <p className="text-slate-500 text-sm">Smart Medical Reminder</p>
        </div>

        <div className="card p-6">
          <div className="flex rounded-lg bg-slate-100 p-1 mb-5 text-sm font-medium">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); setInfo(null) }}
              className={`flex-1 py-1.5 rounded-md transition ${mode === 'signin' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setInfo(null) }}
              className={`flex-1 py-1.5 rounded-md transition ${mode === 'signup' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
            >
              Create Account
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2 border border-slate-300 rounded-lg py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition mb-4"
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-xs text-slate-400">or</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label">Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. johndoe" autoFocus />
            </div>
            {mode === 'signup' && (
              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            )}
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            {error && <p className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2">{error}</p>}
            {info && <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-lg px-3 py-2">{info}</p>}

            <button type="submit" disabled={submitting} className="btn-primary w-full mt-2">
              {submitting ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Your medications, reminders, and health records are private to your account.
        </p>
      </div>
    </div>
  )
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.58-5.17 3.58-8.87z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.31 14.33A7.2 7.2 0 0 1 4.93 12c0-.81.14-1.6.38-2.33V6.58H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.42z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.3 6.58l4.01 3.1C6.25 6.86 8.89 4.77 12 4.77z" />
    </svg>
  )
}