"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase, type Membership, type Invite } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { Plus, MoreHorizontal, Trash2, RotateCw } from "lucide-react"
import { toast } from "sonner"
import { InviteMemberModal } from "@/components/invite-member-modal"

interface MemberWithProfile extends Membership {
  email?: string
  full_name?: string
}

export default function TeamPage() {
  const { user } = useAuth()
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  // TODO: Fetch memberships filtered by user's org_id
  // When org scoping is implemented, this will filter by organization
  const loadTeamData = async () => {
    try {
      if (!user?.id) return

      // Get user's organization membership
      const { data: userMembership, error: memberError } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle()

      if (userMembership) {
        setUserRole(userMembership.role)
      }

      // TODO: Filter by org_id when org scoping is implemented
      // For now, fetch all memberships with profile data
      const { data: membershipsData, error: membershipsError } = await supabase
        .from("memberships")
        .select("*, auth.users(email)")
        .order("joined_at", { ascending: false })

      if (!membershipsError && membershipsData) {
        const membersWithProfiles: MemberWithProfile[] = []
        for (const membership of membershipsData) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", membership.user_id)
            .maybeSingle()

          membersWithProfiles.push({
            ...membership,
            email: (membership.auth as any)?.users?.[0]?.email,
            full_name: profile?.full_name,
          })
        }
        setMembers(membersWithProfiles)
      }

      // TODO: Filter by org_id when org scoping is implemented
      const { data: invitesData, error: invitesError } = await supabase
        .from("invites")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (!invitesError && invitesData) {
        setPendingInvites(invitesData)
      }
    } catch (error) {
      console.error("[v0] Error loading team data:", error)
      toast.error("Failed to load team data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTeamData()
  }, [user?.id])

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return

    try {
      const { error } = await supabase
        .from("memberships")
        .delete()
        .eq("id", memberId)

      if (error) throw error
      setMembers(members.filter((m) => m.id !== memberId))
      toast.success("Member removed successfully")
    } catch (error) {
      console.error("[v0] Error removing member:", error)
      toast.error("Failed to remove member")
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from("invites")
        .update({ status: "revoked" })
        .eq("id", inviteId)

      if (error) throw error
      setPendingInvites(pendingInvites.filter((i) => i.id !== inviteId))
      toast.success("Invitation revoked")
    } catch (error) {
      console.error("[v0] Error revoking invite:", error)
      toast.error("Failed to revoke invitation")
    }
  }

  const handleResendInvite = async (invite: Invite) => {
    try {
      // TODO: Implement resend invite logic using sendInviteMemberEmail
      toast.info("Resend invite not yet implemented")
    } catch (error) {
      console.error("[v0] Error resending invite:", error)
      toast.error("Failed to resend invitation")
    }
  }

  const getRoleColor = (role: string) => {
    return role === "admin"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : "bg-gray-100 text-gray-800 border-gray-200"
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team</h1>
            <p className="text-muted-foreground">Manage your team members and invitations</p>
          </div>
          {userRole === "admin" && (
            <Button onClick={() => setInviteModalOpen(true)}>
              <Plus className="mr-2 size-4" />
              Invite Member
            </Button>
          )}
        </div>

        {/* Members Section */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Team Members</h2>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading team members...</div>
          ) : members.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No team members yet
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => (
                <Card key={member.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <span className="text-sm font-semibold">
                            {(member.full_name || member.email || "?")
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {member.full_name || member.email}
                          </CardTitle>
                          <CardDescription className="text-xs">{member.email}</CardDescription>
                        </div>
                      </div>
                      {userRole === "admin" && member.user_id !== user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 size-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="text-sm text-muted-foreground">Role:</span>
                      <Badge className={getRoleColor(member.role)}>
                        {member.role === "admin" ? "Admin" : "Member"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined{" "}
                      {new Date(member.joined_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Pending Invites Section */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Pending Invitations</h2>
          {pendingInvites.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending invitations
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingInvites.map((invite) => (
                <Card key={invite.id} className="border-dashed opacity-75">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{invite.email}</CardTitle>
                        <CardDescription className="text-xs">Pending invitation</CardDescription>
                      </div>
                      {userRole === "admin" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleResendInvite(invite)}>
                              <RotateCw className="mr-2 size-4" />
                              Resend
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRevokeInvite(invite.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 size-4" />
                              Revoke
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="text-sm text-muted-foreground">Role:</span>
                      <Badge className={getRoleColor(invite.role)}>
                        {invite.role === "admin" ? "Admin" : "Member"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Invited{" "}
                      {new Date(invite.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Expires{" "}
                      {new Date(invite.expires_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Invite Modal */}
        <InviteMemberModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          onSuccess={loadTeamData}
        />
      </div>
    </DashboardLayout>
  )
}
