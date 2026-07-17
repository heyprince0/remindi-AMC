"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

interface InviteMemberModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function InviteMemberModal({
  open,
  onOpenChange,
  onSuccess,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState<"admin" | "member" | "technician">("member")
  const [loading, setLoading] = useState(false)
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([])
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("")
  const [loadingTechnicians, setLoadingTechnicians] = useState(false)

  // Fetch unlinked technicians when role becomes 'technician'
  useEffect(() => {
    const fetchTechnicians = async () => {
      if (role !== "technician") {
        setTechnicians([])
        setSelectedTechnicianId("")
        return
      }

      setLoadingTechnicians(true)
      try {
        // Get current org_id from session (user must be logged in)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          toast.error("You must be logged in to perform this action")
          setLoadingTechnicians(false)
          return
        }

        // Get org_id from memberships
        const { data: membership, error: membershipError } = await supabase
          .from("memberships")
          .select("org_id")
          .eq("user_id", session.user.id)
          .maybeSingle()

        if (membershipError || !membership?.org_id) {
          toast.error("Could not determine your organization")
          setLoadingTechnicians(false)
          return
        }

        const { data, error } = await supabase
          .from("technicians")
          .select("id, name")
          .eq("org_id", membership.org_id)
          .is("linked_user_id", null)   // only unlinked technicians
          .order("name", { ascending: true })

        if (error) throw error
        setTechnicians(data || [])
      } catch (error) {
        console.error("Failed to fetch technicians:", error)
        toast.error("Could not load technician list")
      } finally {
        setLoadingTechnicians(false)
      }
    }

    fetchTechnicians()
  }, [role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      toast.error("Please enter an email address")
      return
    }

    if (!displayName.trim()) {
      toast.error("Please enter a name for this member")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address")
      return
    }

    // If role is technician, ensure a technician is selected
    if (role === "technician" && !selectedTechnicianId) {
      toast.error("Please select a technician profile for this user")
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        toast.error("Your session has expired. Please log in again.")
        setLoading(false)
        return
      }

      const response = await fetch("/api/invites/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email,
          role,
          displayName: displayName.trim(),
          technicianId: role === "technician" ? selectedTechnicianId : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          toast.error("This person has already been invited or is already a member")
        } else if (response.status === 401) {
          toast.error("Your session has expired. Please log in again.")
        } else {
          toast.error(data.message || "Failed to send invitation")
        }
        return
      }

      if (data.emailWarning) {
        toast.warning(data.emailWarning)
      } else {
        toast.success("Invitation sent successfully!")
      }

      setEmail("")
      setDisplayName("")
      setRole("member")
      setSelectedTechnicianId("")
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("[v0] Error sending invitation:", error)
      toast.error("Failed to send invitation")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to a new team member
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Full Name</Label>
            <Input
              id="displayName"
              placeholder="e.g. John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="member@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(value: "admin" | "member" | "technician") => setRole(value)}
              disabled={loading}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="technician">Technician</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Technician selection - only shown when role is technician */}
          {role === "technician" && (
            <div className="space-y-2">
              <Label htmlFor="technician">Select Technician Profile</Label>
              <Select
                value={selectedTechnicianId}
                onValueChange={setSelectedTechnicianId}
                disabled={loading || loadingTechnicians}
              >
                <SelectTrigger id="technician">
                  <SelectValue placeholder={
                    loadingTechnicians
                      ? "Loading technicians..."
                      : technicians.length === 0
                      ? "No unlinked technicians available"
                      : "Select a technician"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {technicians.length === 0 && !loadingTechnicians && (
                <p className="text-xs text-muted-foreground">
                  No unlinked technicians available. Create a technician first.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: "#2ea4e6" }}
              className="text-white hover:opacity-90"
            >
              {loading ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
