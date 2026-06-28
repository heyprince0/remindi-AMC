'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
  role: string | null      // <-- new
  orgId: string | null     // <-- new
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  // Fetch initial session
  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session }, error: err } = await supabase.auth.getSession()
        if (err) throw err
        setSession(session)
        setUser(session?.user ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get session')
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setError(null)
      }
    )

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  // Fetch role & org when user changes
  useEffect(() => {
    const fetchMembership = async () => {
      if (!user) {
        setRole(null)
        setOrgId(null)
        return
      }
      const { data, error } = await supabase
        .from('memberships')
        .select('role, org_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setRole(data.role)
        setOrgId(data.org_id)
      } else {
        setRole(null)
        setOrgId(null)
      }
    }
    fetchMembership()
  }, [user])

  return (
    <AuthContext.Provider value={{ user, session, loading, error, role, orgId }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
