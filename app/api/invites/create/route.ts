import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@supabase/supabase-js"
import { sendInviteMemberEmail } from "@/lib/email-service"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const accessToken = authHeader?.replace("Bearer ", "")

    if (!accessToken) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // 🔹 Accept technicianId in the request
    const { email, role, displayName, technicianId } = await request.json()

    if (!email || !role || !displayName?.trim()) {
      return NextResponse.json(
        { message: "Email, role, and display name are required" },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: "Invalid email format" },
        { status: 400 }
      )
    }

    if (!["admin", "member", "technician"].includes(role)) {
      return NextResponse.json(
        { message: "Invalid role" },
        { status: 400 }
      )
    }

    // 🔹 If role is technician, technicianId is required
    if (role === "technician" && !technicianId) {
      return NextResponse.json(
        { message: "Technician ID is required for technician role" },
        { status: 400 }
      )
    }

    // 1. Get the inviter's org and role
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("org_id, role")
      .eq("user_id", user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { message: "You are not a member of any organization" },
        { status: 403 }
      )
    }

    if (membership.role !== "admin") {
      return NextResponse.json(
        { message: "Only admins can invite members" },
        { status: 403 }
      )
    }

    const orgId = membership.org_id

    // 🔹 If technicianId is provided, verify it belongs to this org and is unlinked
    if (technicianId) {
      const { data: tech, error: techError } = await supabase
        .from("technicians")
        .select("id")
        .eq("id", technicianId)
        .eq("org_id", orgId)
        .is("linked_user_id", null)
        .maybeSingle()

      if (techError || !tech) {
        return NextResponse.json(
          { message: "Selected technician does not exist or is already linked" },
          { status: 400 }
        )
      }
    }

    // 2. Check for a valid pending invite (not expired)
    const now = new Date().toISOString()
    const { data: pendingInvite, error: pendingError } = await supabase
      .from("invites")
      .select("id, status, expires_at")
      .eq("org_id", orgId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle()

    if (pendingInvite) {
      if (new Date(pendingInvite.expires_at) > new Date()) {
        return NextResponse.json(
          { message: "This person already has a pending invitation" },
          { status: 409 }
        )
      } else {
        await supabase
          .from("invites")
          .delete()
          .eq("id", pendingInvite.id)
      }
    }

    // 3. Check if the email belongs to an existing user who is currently a member
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: { users }, error: usersError } = await adminSupabase.auth.admin.listUsers()

    if (usersError) {
      console.error("Failed to list users:", usersError)
    }

    const existingUser = users?.find((u) => u.email === email)
    if (existingUser) {
      const { data: existingMembership, error: memCheckError } = await supabase
        .from("memberships")
        .select("id")
        .eq("org_id", orgId)
        .eq("user_id", existingUser.id)
        .maybeSingle()

      if (existingMembership) {
        return NextResponse.json(
          { message: "This person is already a member of your organization" },
          { status: 409 }
        )
      }
    }

    // 4. Delete any stale accepted/revoked invites
    await supabase
      .from("invites")
      .delete()
      .eq("org_id", orgId)
      .eq("email", email)
      .neq("status", "pending")

    // 5. Create the new invite with technician_id if provided
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const inviteData: any = {
      org_id: orgId,
      email,
      role,
      token,
      status: "pending",
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
      display_name: displayName.trim(),
    }

    // 🔹 Store technician_id if provided
    if (technicianId) {
      inviteData.technician_id = technicianId
    }

    const { data: invite, error: insertError } = await supabase
      .from("invites")
      .insert([inviteData])
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Error creating invite:", insertError)
      return NextResponse.json(
        { message: "Failed to create invite" },
        { status: 500 }
      )
    }

    // 6. Send email
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()

    const inviterName = inviterProfile?.full_name || user.email || "Team"

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle()

    const businessName = org?.name || "Remindi"

    const acceptLink = `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.remindi.online"}/invite/accept/${token}`

    const emailResult = await sendInviteMemberEmail(
      email,
      inviterName,
      businessName,
      role,
      acceptLink,
      displayName.trim()
    )

    if (!emailResult.success) {
      console.warn("[v0] Email sending issue:", emailResult.error)
      return NextResponse.json(
        {
          success: true,
          emailWarning: "Invitation created but email may not have been delivered. Please verify the email address.",
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "Invitation sent successfully",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[v0] Error in invite create route:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
