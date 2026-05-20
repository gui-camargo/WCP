import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface Profile {
  id: string
  name: string
  email: string
  is_admin: boolean
  active_pool_id: string | null
}

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  setActivePool: (poolId: string | null) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    console.info('[Auth] loadProfile:start', { userId })

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[Auth] loadProfile:error', {
        userId,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
    } else {
      console.info('[Auth] loadProfile:success', { userId, hasProfile: Boolean(data) })
    }

    setProfile(data ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    console.info('[Auth] signIn:start', { email, passwordLength: password.length })

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error('[Auth] signIn:error', {
        email,
        message: error.message,
        status: (error as any).status,
        code: (error as any).code,
        name: error.name,
      })
    } else {
      console.info('[Auth] signIn:success', {
        email,
        userId: data.user?.id,
        hasSession: Boolean(data.session),
      })
    }

    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string, name: string) {
    console.info('[Auth] signUp:start', {
      email,
      nameLength: name.trim().length,
      passwordLength: password.length,
    })

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })

    if (error) {
      console.error('[Auth] signUp:error', {
        message: error.message,
        status: (error as any).status,
        code: (error as any).code,
        name: error.name,
      })
      return { error: error.message }
    }

    console.info('[Auth] signUp:success', {
      userId: data.user?.id,
      hasSession: Boolean(data.session),
      emailConfirmedAt: data.user?.email_confirmed_at ?? null,
    })

    return { error: null }
  }

  async function setActivePool(poolId: string | null) {
    if (!user) return { error: 'Usuário não autenticado.' }

    const { data, error } = await (supabase
      .from('profiles') as any)
      .update({ active_pool_id: poolId })
      .eq('id', user.id)
      .select('*')
      .single()

    if (error) {
      return { error: error.message }
    }

    setProfile((data as Profile) ?? null)
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, setActivePool, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
