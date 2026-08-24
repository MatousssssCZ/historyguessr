import { useState, useEffect, createContext, useContext } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, getProfile } from '@/lib/supabase'
import type { Profile } from '@/types/database'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  isEditor: boolean
  isAnonymous: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isEditor: false,
  isAnonymous: false,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Načti aktuální session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) loadProfile(data.session.user.id)
      else setLoading(false)
    })

    // Sleduj změny auth stavu
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await getProfile(userId)
    setProfile(data)
    setLoading(false)
  }

  async function refreshProfile() {
    if (user) {
      const { data } = await getProfile(user.id)
      setProfile(data)
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      isEditor: profile?.role === 'editor' || profile?.role === 'admin',
      isAnonymous: !!(user as (User & { is_anonymous?: boolean }) | null)?.is_anonymous,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
