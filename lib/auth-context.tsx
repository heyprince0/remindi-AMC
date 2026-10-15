'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { getSubscriptionAccessState, SubscriptionAccessState } from './billing-helpers'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
  role: string | null
  orgId: string | null
  orgName: string | null
  recovery: boolean
  technicianId: string | null
  subscriptionAccess: SubscriptionAccessState
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function isRecoverySession(session: Session | null): boolean {
  if (!session) return false
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
  const [technicianId, setTechnicianId] = useState<string | null>(null)
  const [subscriptionAccess, setSubscriptionAccess] = useState<SubscriptionAccessState>('active')

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session }, error: err } = await supabase.auth.getSession()
        if (err) throw err
        setSession(session)
        setUser(session?.user ?? null)
        if (isRecoverySession(session)) setRecovery(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get session')
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setError(null)
        if (event === 'PASSWORD_RECOVERY' || isRecoverySession(session)) {
          setRecovery(true)
        } else {
          setRecovery(false)
        }
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    const fetchMembership = async () => {
      if (!user) {
        setRole(null); setOrgId(null); setOrgName(null); setTechnicianId(null); setSubscriptionAccess('active')
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
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('status, end_date, trial_end_date')
            .eq('org_id', data.org_id)
            .maybeSingle()
          setSubscriptionAccess(getSubscriptionAccessState(subscription))

          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', data.org_id)
            .maybeSingle()
          if (!orgError && orgData?.name) setOrgName(orgData.name)
          else setOrgName(null)

          // For technician role, fetch linked technician_id
          if (data.role === 'technician') {
            const { data: techData } = await supabase
              .from('technicians')
              .select('id')
              .eq('user_id', user.id)
              .eq('org_id', data.org_id)
              .maybeSingle()
            setTechnicianId(techData?.id || null)
          } else {
            setTechnicianId(null)
          }
        } else setOrgName(null)
      } else {
        setRole(null); setOrgId(null); setOrgName(null); setTechnicianId(null); setSubscriptionAccess('locked')
      }
    }
    fetchMembership()
  }, [user])

  return (
    <AuthContext.Provider value={{ user, session, loading, error, role, orgId, orgName, recovery, technicianId, subscriptionAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
