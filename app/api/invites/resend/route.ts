import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendInviteMemberEmail } from "@/lib/email-service"

export async function POST(request: NextRequest) {
  try {
    // Same auth pattern as the create route
    const authHeader = request.headers.get("authorization")
    const accessToken = authHeader?.replace("Bearer ", "")

    if (!accessToken) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { inviteId } = await request.json()

    if (!inviteId) {
      return NextResponse.json({ message: "Invite ID is required" }, { status: 400 })
    }

    // Fetch the invite
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("*")
      .eq("id", inviteId)
      .eq("status", "pending")
      .maybeSingle()

    if (inviteError || !invite) {
      return NextResponse.json(
        { message: "Invite not found or is no longer pending" },
        { status: 404 }
      )
    }

    // Confirm caller is an admin of this org
    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("org_id", invite.org_id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (membership?.role !== "admin") {
      return NextResponse.json(
        { message: "Only admins can resend invitations" },
        { status: 403 }
      )
    }

    // Get org name for the email
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", invite.org_id)
      .maybeSingle()

    // Get inviter name
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()

    const inviterName = inviterProfile?.full_name || user.email || "Team"
    const businessName = org?.name || "Remindi"

    // Extend expiry by 7 days from now
    const newExpiry = new Date()
    newExpiry.setDate(newExpiry.getDate() + 7)

    await supabase
      .from("invites")
      .update({ expires_at: newExpiry.toISOString() })
      .eq("id", inviteId)

    // Reconstruct the accept link using the existing token
    const acceptLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.remindi.online"}/invite/accept/${invite.token}`

    const emailResult = await sendInviteMemberEmail(
      invite.email,
      inviterName,
      businessName,
      invite.role,
      acceptLink
    )

    if (!emailResult.success) {
      return NextResponse.json(
        {
          success: true,
          emailWarning: "Invite expiry extended but email may not have been delivered.",
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { success: true, message: "Invitation resent successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("[invites/resend] Unhandled error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
