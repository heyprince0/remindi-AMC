'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { InviteAcceptCard } from '@/components/team/invite-accept-card'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

interface InviteDetails {
  email: string
  businessName: string
  inviterName: string
  role: 'admin' | 'member'
  status: 'valid' | 'expired' | 'revoked' | 'accepted'
}

export default function InviteAcceptPage() {
  const params = useParams()
  const token = params.token as string
  const { user, loading: authLoading } = useAuth()
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    const fetchInvite = async () => {
      try {
        const response = await fetch(`/api/invites/${token}`)
        
        if (!response.ok) {
          setLoading(false)
          return
        }

        const data = await response.json()
        const { invite, valid, status } = data

        setInviteDetails({
          email: invite.email,
          businessName: invite.organizations?.name || 'Organization',
          inviterName: invite.inviter?.full_name || 'Team',
          role: invite.role || 'member',
          status: valid ? 'valid' : status || 'expired',
        })
      } catch (error) {
        console.error('Error fetching invite:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInvite()
  }, [token, authLoading])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full flex flex-col items-center gap-4">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
        <InviteAcceptCard
          token={token}
          inviteDetails={inviteDetails}
          loading={loading}
          userEmail={user?.email}
        />
      </div>
    </div>
  )
}
