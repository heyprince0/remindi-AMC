import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@supabase/supabase-js"
import { sendInviteMemberEmail } from "@/lib/email-service"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Plain supabase-js client, used only to validate the token the
    // browser sent us — not relying on cookies at all, since this app's
    // browser client stores sessions in localStorage (storageKey:
    // 'remindi-auth-token'), which the server can never read directly.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { email, role } = await request.json()

    if (!email || !role) {
      return NextResponse.json(
        { message: "Email and role are required" },
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

    // TODO: Get user's organization ID (for now, use first org)
    // When org scoping is implemented, fetch the user's current org
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id")
      .limit(1)

    if (orgsError || !orgs || orgs.length === 0) {
      return NextResponse.json(
        { message: "Organization not found" },
        { status: 400 }
      )
    }

    const orgId = orgs[0].id

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { message: "You are not a member of this organization" },
        { status: 403 }
      )
    }

    if (membership.role !== "admin") {
      return NextResponse.json(
        { message: "Only admins can invite members" },
        { status: 403 }
      )
    }

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

    const acceptLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/accept/${token}`

    const emailResult = await sendInviteMemberEmail(
      email,
      inviterName,
      businessName,
      acceptLink
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
