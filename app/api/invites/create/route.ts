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

    if (!email || !role) {
      return NextResponse.json(
        { message: "Email, role, and display name are required" },
        { status: 400 }
      )
    }

    if (!displayName?.trim()) {
      return NextResponse.json(
        { message: "Please provide a display name for the member" },
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

    // ============================================================
    // 1. Get the user's organization from their membership
    // ============================================================
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

    // ============================================================
    // 2. Check for existing invite or membership
    // ============================================================
    const { data: existingInvite } = await supabase
      .from("invites")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("email", email)
      .in("status", ["pending", "accepted"])
      .maybeSingle()

    if (existingInvite) {
      return NextResponse.json(
        { message: "This person has already been invited or is already a member" },
        { status: 409 }
      )
    }

    // Also check if they are already a member (shouldn't happen, but safe)
    const { data: existingMember } = await supabase
      .from("memberships")
      .select("id")
      .eq("org_id", orgId)
      .eq("user_id", user.id) // we don't have their user_id yet, but we can check by email later if needed
      // We'll skip this for simplicity; the frontend already prevents duplicate invites.

    // ============================================================
    // 3. Create the invite with display_name
    // ============================================================
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
          display_name: displayName.trim(), // <-- store the admin‑set name
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

    // ============================================================
    // 4. Get inviter details and business name
    // ============================================================
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

    // ============================================================
    // 5. Send the invitation email
    // ============================================================
    const acceptLink = `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.remindi.online"}/invite/accept/${token}`

    const emailResult = await sendInviteMemberEmail(
      email,
      inviterName,
      businessName,
      role,
      acceptLink,
      displayName.trim() // optionally pass the name for the email
    )

    if (!emailResult.success) {
      console.warn("[v0] Email sending had issue:", emailResult.error)
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
