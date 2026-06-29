'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
  role: string | null
  orgId: string | null
  orgName: string | null
  recovery: boolean  // <-- add this
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [recovery, setRecovery] = useState(false)  // <-- add this

  // Initial session
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

    // Listen for auth changes – capture PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setError(null)

        if (event === 'PASSWORD_RECOVERY') {
          setRecovery(true)
        } else {
          setRecovery(false)
        }
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  // Fetch role, orgId, and orgName whenever user changes
  useEffect(() => {
    const fetchMembership = async () => {
      if (!user) {
        setRole(null)
        setOrgId(null)
        setOrgName(null)
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

        if (data.org_id) {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', data.org_id)
            .maybeSingle()

          if (!orgError && orgData?.name) {
            setOrgName(orgData.name)
          } else {
            setOrgName(null)
          }
        } else {
          setOrgName(null)
        }
      } else {
        setRole(null)
        setOrgId(null)
        setOrgName(null)
      }
    }

    fetchMembership()
  }, [user])

  return (
    <AuthContext.Provider value={{ user, session, loading, error, role, orgId, orgName, recovery }}>
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
