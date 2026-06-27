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
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)

  // Fetch current user's org and role
  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id, role")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setCurrentOrgId(data.org_id)
            setUserRole(data.role)
            loadTeamData(data.org_id)
          }
        })
    }
  }, [user?.id])

  const loadTeamData = async (orgId: string) => {
    try {
      if (!orgId) return

      const { data: membershipsData, error: membershipsError } = await supabase
        .from("memberships")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })

      if (membershipsError) throw membershipsError

      const membersWithProfiles: MemberWithProfile[] = []

      for (const membership of membershipsData || []) {
        let fullName: string | undefined
        let email: string | undefined

        if (membership.display_name) {
          fullName = membership.display_name
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", membership.user_id)
            .maybeSingle()

          if (profile?.full_name) {
            fullName = profile.full_name
          }

          if (!fullName) {
            const { data: cp } = await supabase
              .from("company_profile")
              .select("company_name")
              .eq("user_id", membership.user_id)
              .maybeSingle()
            if (cp?.company_name) {
              fullName = cp.company_name
            }
          }
        }

        const { data: cpEmail } = await supabase
          .from("company_profile")
          .select("email")
          .eq("user_id", membership.user_id)
          .maybeSingle()

        if (cpEmail?.email) {
          email = cpEmail.email
        }

        membersWithProfiles.push({
          ...membership,
          full_name: fullName,
          email: email,
        })
      }

      setMembers(membersWithProfiles)

      const { data: invitesData, error: invitesError } = await supabase
        .from("invites")
        .select("*")
        .eq("org_id", orgId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (!invitesError) {
        setPendingInvites(invitesData || [])
      }
    } catch (error) {
      console.error("[team] Error loading team data:", error)
      toast.error("Failed to load team data")
    } finally {
      setLoading(false)
    }
  }

  // Redirect non-admin users
  useEffect(() => {
    if (userRole && userRole !== "admin") {
      toast.error("You don't have permission to view this page")
    }
  }, [userRole])

  // ========== FIXED: Member removal ==========
  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return
    try {
      console.log("Deleting membership with ID:", memberId)

      const { data, error } = await supabase
        .from("memberships")
        .delete()
        .eq("id", memberId)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        toast.error("Member not found or you don't have permission to remove them")
        return
      }

      if (currentOrgId) loadTeamData(currentOrgId)
      toast.success("Member removed successfully")
    } catch (error) {
      console.error("[team] Error removing member:", error)
      toast.error(error instanceof Error ? error.message : "Failed to remove member")
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from("invites")
        .update({ status: "revoked" })
        .eq("id", inviteId)
        .eq("org_id", currentOrgId)
      if (error) throw error
      if (currentOrgId) loadTeamData(currentOrgId)
      toast.success("Invitation revoked")
    } catch (error) {
      console.error("[team] Error revoking invite:", error)
      toast.error("Failed to revoke invitation")
    }
  }

  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm("Permanently delete this invitation? The person will need to be re-invited.")) return
    try {
      const { error } = await supabase
        .from("invites")
        .delete()
        .eq("id", inviteId)
        .eq("org_id", currentOrgId)
      if (error) throw error
      if (currentOrgId) loadTeamData(currentOrgId)
      toast.success("Invitation deleted")
    } catch (error) {
      console.error("[team] Error deleting invite:", error)
      toast.error("Failed to delete invitation")
    }
  }

  const handleResendInvite = async (invite: Invite) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error("Your session has expired. Please log in again.")
        return
      }
      const response = await fetch("/api/invites/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ inviteId: invite.id }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.message || "Failed to resend invitation")
        return
      }
      if (data.emailWarning) {
        toast.warning(data.emailWarning)
      } else {
        toast.success("Invitation resent successfully!")
      }
    } catch (error) {
      console.error("[team] Error resending invite:", error)
      toast.error("Failed to resend invitation")
    }
  }

  const getRoleColor = (role: string) => {
    return role === "admin"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : "bg-gray-100 text-gray-800 border-gray-200"
  }

  const getInitials = (name?: string, email?: string) => {
    if (name && name !== "Team Member") {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    }
    if (email) return email[0].toUpperCase()
    return "TM"
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
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
                            {getInitials(member.full_name, member.email)}
                          </span>
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {member.full_name || member.email || "Team Member"}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {member.email || `ID: ${member.user_id.slice(0, 8)}...`}
                          </CardDescription>
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
                      {new Date(member.created_at).toLocaleDateString("en-US", {
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
                        <CardTitle className="text-base">
                          {invite.display_name || invite.email}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {invite.email}
                        </CardDescription>
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
                              className="text-yellow-600"
                            >
                              <Trash2 className="mr-2 size-4" />
                              Revoke
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteInvite(invite.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
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

        <InviteMemberModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          onSuccess={() => {
            if (currentOrgId) loadTeamData(currentOrgId)
          }}
        />
      </div>
    </DashboardLayout>
  )
}
