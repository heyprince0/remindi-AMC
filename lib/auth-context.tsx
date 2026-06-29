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
  recovery: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Helper to check if a session is a recovery session
function isRecoverySession(session: Session | null): boolean {
  if (!session) return false
  // Check amr claim: method=password, type=recovery
  const amr = session.user?.amr
  if (!amr || !Array.isArray(amr)) return false
  return amr.some((factor: any) => factor.method === 'password' && factor.type === 'recovery')
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [recovery, setRecovery] = useState(false)

  // Initial session & recovery detection
  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session }, error: err } = await supabase.auth.getSession()
        if (err) throw err
        setSession(session)
        setUser(session?.user ?? null)
        // Check if this is a recovery session right away
        if (isRecoverySession(session)) {
          setRecovery(true)
        }
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

        if (event === 'PASSWORD_RECOVERY') {
          setRecovery(true)
        } else if (isRecoverySession(session)) {
          // In case the event is missed, check the session directly
          setRecovery(true)
        } else {
          setRecovery(false)
        }
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  // Fetch role, orgId, orgName (unchanged)
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
