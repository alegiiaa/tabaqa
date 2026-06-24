import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Provider, Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

interface AuthResult {
  /** A human-readable error message, or null on success. */
  error: string | null
  /** True when a sign-up needs email confirmation before a session exists. */
  needsConfirmation?: boolean
}

interface AuthValue {
  user: User | null
  session: Session | null
  /** True until the initial session has been resolved. */
  loading: boolean
  configured: boolean
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>
  signUpWithPassword: (email: string, password: string) => Promise<AuthResult>
  signInWithOAuth: (provider: Provider) => Promise<AuthResult>
  resetPassword: (email: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

const NOT_CONFIGURED: AuthResult = {
  error:
    'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    'to app/web/.env.local and restart the dev server.',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(() => {
    /** Where the provider should send the user back to after OAuth / email links. */
    const redirectTo = `${window.location.origin}/app`

    return {
      user: session?.user ?? null,
      session,
      loading,
      configured: isSupabaseConfigured,

      async signInWithPassword(email, password) {
        if (!isSupabaseConfigured) return NOT_CONFIGURED
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },

      async signUpWithPassword(email, password) {
        if (!isSupabaseConfigured) return NOT_CONFIGURED
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        })
        if (error) return { error: error.message }
        // When email confirmation is on, no session is returned yet.
        return { error: null, needsConfirmation: !data.session }
      },

      async signInWithOAuth(provider) {
        if (!isSupabaseConfigured) return NOT_CONFIGURED
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo },
        })
        // On success the browser is redirected away, so this only returns on error.
        return { error: error?.message ?? null }
      },

      async resetPassword(email) {
        if (!isSupabaseConfigured) return NOT_CONFIGURED
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        })
        return { error: error?.message ?? null }
      },

      async signOut() {
        await supabase.auth.signOut()
      },
    }
  }, [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
