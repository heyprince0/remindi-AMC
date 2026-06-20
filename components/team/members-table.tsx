'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Trash2 } from 'lucide-react'

interface Member {
  id: string
  email: string
  name: string
  role: 'admin' | 'member'
  createdAt: string
}

interface MembersTableProps {
  members: Member[]
  loading?: boolean
  isCurrentUserAdmin: boolean
  onRemoveClick?: (memberId: string) => void
}

export function MembersTable({
  members,
  loading,
  isCurrentUserAdmin,
  onRemoveClick,
}: MembersTableProps) {
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  const handleRemoveClick = (memberId: string) => {
    setSelectedMemberId(memberId)
    setRemoveConfirmOpen(true)
  }

  const handleConfirmRemove = () => {
    if (selectedMemberId && onRemoveClick) {
      onRemoveClick(selectedMemberId)
    }
    setRemoveConfirmOpen(false)
    setSelectedMemberId(null)
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading team members...
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No team members yet
      </div>
    )
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {isCurrentUserAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell className="text-muted-foreground">{member.email}</TableCell>
                <TableCell>
                  <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                    {member.role === 'admin' ? 'Admin' : 'Member'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(member.createdAt), { addSuffix: true })}
                </TableCell>
                {isCurrentUserAdmin && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveClick(member.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove member</span>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this team member? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Remove
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
