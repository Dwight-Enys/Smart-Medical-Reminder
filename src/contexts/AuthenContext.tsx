import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types'

const LICENSE_PATTERN = /^CG-[0-9]{3,}$/

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  profileLoading: boolean
  loading: boolean
  signIn: (username: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    username: string,
    email: string,
    password: string,
    role: UserRole,
    licenseNumber?: string
  ) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const loadProfile = useCallback(async (userId: string) => {
    setProfileLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile((data as Profile) ?? null)
    setProfileLoading(false)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await loadProfile(session.user.id)
  }, [session, loadProfile])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user?.id) {
      loadProfile(session.user.id)
    } else {
      setProfile(null)
    }
  }, [session, loadProfile])

  async function signIn(username: string, password: string) {
    const { data: email, error: lookupError } = await supabase.rpc('get_email_for_username', {
      p_username: username,
    })
    if (lookupError || !email) {
      return { error: 'No account found with that username.' }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(
    username: string,
    email: string,
    password: string,
    role: UserRole,
    licenseNumber?: string
  ) {
    if (role === 'caregiver') {
      const trimmed = (licenseNumber ?? '').trim().toUpperCase()
      if (!LICENSE_PATTERN.test(trimmed)) {
        return { error: 'Caregiver license number must look like CG-001 (CG- followed by 3+ digits).' }
      }
      licenseNumber = trimmed
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username,
        email,
        role,
        license_number: role === 'caregiver' ? licenseNumber : null,
      })
      if (profileError) {
        if (profileError.message.includes('duplicate') || profileError.message.includes('unique')) {
          return {
            error: profileError.message.includes('license')
              ? 'That caregiver license number is already registered.'
              : 'That username is already taken.',
          }
        }
        return { error: profileError.message }
      }
    }
    return { error: null }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        profileLoading,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
