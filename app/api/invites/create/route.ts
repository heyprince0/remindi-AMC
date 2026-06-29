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

    const { email, role, displayName } = await request.json()

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

    if (!["admin", "member"].includes(role)) {
      return NextResponse.json(
        { message: "Invalid role" },
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
      // If the invite is still valid (not expired), block
      if (new Date(pendingInvite.expires_at) > new Date()) {
        return NextResponse.json(
          { message: "This person already has a pending invitation" },
          { status: 409 }
        )
      } else {
        // If the pending invite is expired, delete it so we can create a new one
        await supabase
          .from("invites")
          .delete()
          .eq("id", pendingInvite.id)
      }
    }

    // 3. Check if the email belongs to an existing user who is currently a member
    // Use service role to list users by email
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: { users }, error: usersError } = await adminSupabase.auth.admin.listUsers()

    if (usersError) {
      console.error("Failed to list users:", usersError)
      // Proceed with invite creation anyway (fallback)
    }

    const existingUser = users?.find((u) => u.email === email)
    if (existingUser) {
      // Check if this user already has a membership in this org
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

    // 4. Delete any stale accepted/revoked invites for this email/org to keep clean
    await supabase
      .from("invites")
      .delete()
      .eq("org_id", orgId)
      .eq("email", email)
      .neq("status", "pending") // delete any accepted or revoked invites

    // 5. Create the new invite
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data: invite, error: insertError } = await supabase
      .from("invites")
      .insert([
        {
          org_id: orgId,
          email,
          role,
          token,
          status: "pending",
          invited_by: user.id,
          expires_at: expiresAt.toISOString(),
          display_name: displayName.trim(),
        },
      ])
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
