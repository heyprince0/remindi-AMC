'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, RotateCcw, X } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

interface PendingInvite {
  id: string
  email: string
  role: 'admin' | 'member'
  sentAt: string
  expiresAt: string
}

interface PendingInvitesTableProps {
  invites: PendingInvite[]
  loading?: boolean
  isCurrentUserAdmin: boolean
  orgId: string
  onRefresh?: () => void
}

export function PendingInvitesTable({
  invites,
  loading,
  isCurrentUserAdmin,
  orgId,
  onRefresh,
}: PendingInvitesTableProps) {
  const { user } = useAuth()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false)
  const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null)

  const handleResend = async (inviteId: string) => {
    try {
      setActionLoading(inviteId)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Authentication error')
        return
      }

      const response = await fetch('/api/invites/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'resend',
          inviteId,
          orgId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resend invite')
      }

      toast.success('Invite resent successfully!')
      onRefresh?.()
    } catch (error) {
      console.error('Error resending invite:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to resend invite')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevoke = async (inviteId: string) => {
    try {
      setActionLoading(inviteId)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Authentication error')
        return
      }

      const response = await fetch('/api/invites/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'revoke',
          inviteId,
          orgId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to revoke invite')
      }

      toast.success('Invite revoked')
      onRefresh?.()
    } catch (error) {
      console.error('Error revoking invite:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to revoke invite')
    } finally {
      setActionLoading(null)
      setRevokeConfirmOpen(false)
      setSelectedInviteId(null)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading pending invites...
      </div>
    )
  }

  if (invites.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No pending invites
      </div>
    )
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Expires</TableHead>
              {isCurrentUserAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => {
              const isExpired = new Date(invite.expiresAt) < new Date()
              return (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant={invite.role === 'admin' ? 'default' : 'secondary'}>
                      {invite.role === 'admin' ? 'Admin' : 'Member'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(invite.sentAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {isExpired ? (
                      <span className="text-destructive">Expired</span>
                    ) : (
                      formatDistanceToNow(new Date(invite.expiresAt), { addSuffix: true })
                    )}
                  </TableCell>
                  {isCurrentUserAdmin && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={actionLoading === invite.id}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleResend(invite.id)}
                            disabled={isExpired || actionLoading !== null}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Resend
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedInviteId(invite.id)
                              setRevokeConfirmOpen(true)
                            }}
                            className="text-destructive"
                            disabled={actionLoading !== null}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={revokeConfirmOpen} onOpenChange={setRevokeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invite</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this invite? The recipient will no longer be able to accept it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (selectedInviteId) {
                handleRevoke(selectedInviteId)
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Revoke
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
