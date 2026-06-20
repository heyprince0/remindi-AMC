'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { InviteDialog } from '@/components/team/invite-dialog'
import { MembersTable } from '@/components/team/members-table'
import { PendingInvitesTable } from '@/components/team/pending-invites-table'

interface Member {
  id: string
  email: string
  name: string
  role: 'admin' | 'member'
  createdAt: string
}

interface PendingInvite {
  id: string
  email: string
  role: 'admin' | 'member'
  sentAt: string
  expiresAt: string
}

export default function TeamPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'member' | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  useEffect(() => {
    if (user?.id) {
      loadTeamData()
    }
  }, [user?.id])

  const loadTeamData = async () => {
    try {
      setLoading(true)

      if (!user?.id) return

      // TODO: fetch from organizations table to get current user's organization
      // For now, we'll need to determine the org_id from context or user profile
      // This assumes user has a default organization - you may need to adjust this logic

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!profile) {
        toast.error('Profile not found')
        return
      }

      // TODO: Get organization ID - may be from user's org_id field or first org they're a member of
      const { data: orgData } = await supabase
        .from('memberships')
        .select('org_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!orgData?.org_id) {
        toast.error('No organization found')
        return
      }

      setOrgId(orgData.org_id)
      setCurrentUserRole(orgData.role as 'admin' | 'member')

      // Fetch members
      // TODO: Fetch from memberships table joined with auth.users and profiles
      // Expected query structure:
      // - memberships table with org_id, user_id, role, created_at
      // - Join with profiles to get full_name
      // - Join with auth.users to get email
      const { data: membershipsData, error: membershipsError } = await supabase
        .from('memberships')
        .select(`
          id,
          user_id,
          role,
          created_at,
          profiles:user_id (full_name),
          users:user_id (email)
        `)
        .eq('org_id', orgData.org_id)

      if (membershipsError) {
        console.error('Error fetching members:', membershipsError)
        toast.error('Failed to load members')
        return
      }

      const formattedMembers: Member[] = membershipsData
        .map((m: any) => ({
          id: m.user_id,
          email: m.users?.email || 'unknown@example.com',
          name: m.profiles?.full_name || 'Unknown User',
          role: m.role,
          createdAt: m.created_at,
        }))
        .sort((a: Member, b: Member) => a.name.localeCompare(b.name))

      setMembers(formattedMembers)

      // Fetch pending invites
      // TODO: Fetch from invites table where org_id matches and status = 'pending'
      const { data: invitesData, error: invitesError } = await supabase
        .from('invites')
        .select('*')
        .eq('org_id', orgData.org_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (invitesError) {
        console.error('Error fetching invites:', invitesError)
        toast.error('Failed to load pending invites')
        return
      }

      const formattedInvites: PendingInvite[] = invitesData.map((i: any) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        sentAt: i.created_at,
        expiresAt: i.expires_at,
      }))

      setPendingInvites(formattedInvites)
    } catch (error) {
      console.error('Error loading team data:', error)
      toast.error('Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!orgId) return

    try {
      // TODO: Delete from memberships table where user_id = memberId and org_id = orgId
      const { error } = await supabase
        .from('memberships')
        .delete()
        .eq('user_id', memberId)
        .eq('org_id', orgId)

      if (error) throw error

      toast.success('Member removed')
      loadTeamData()
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error('Failed to remove member')
    }
  }

  const isAdmin = currentUserRole === 'admin'

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team Members</h1>
            <p className="text-muted-foreground">Manage your team and organization members</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setInviteDialogOpen(true)}>
              <Plus className="mr-2 size-4" />
              Invite Member
            </Button>
          )}
        </div>

        {/* Current Members */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members ({members.length})</CardTitle>
            <CardDescription>
              People who are part of your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MembersTable
              members={members}
              loading={loading}
              isCurrentUserAdmin={isAdmin}
              onRemoveClick={handleRemoveMember}
            />
          </CardContent>
        </Card>

        {/* Pending Invites */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites ({pendingInvites.length})</CardTitle>
            <CardDescription>
              Invitations that haven&apos;t been accepted yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PendingInvitesTable
              invites={pendingInvites}
              loading={loading}
              isCurrentUserAdmin={isAdmin}
              orgId={orgId || ''}
              onRefresh={loadTeamData}
            />
          </CardContent>
        </Card>

        {/* Invite Dialog */}
        {orgId && (
          <InviteDialog
            open={inviteDialogOpen}
            onOpenChange={setInviteDialogOpen}
            orgId={orgId}
            onSuccess={loadTeamData}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
