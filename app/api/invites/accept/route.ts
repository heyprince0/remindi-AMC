import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
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

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ message: "Token is required" }, { status: 400 })
    }

    // Fetch and validate invite
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .maybeSingle()

    if (inviteError || !invite) {
      return NextResponse.json({ message: "Invite not found" }, { status: 404 })
    }

    // Check expiry
    if (new Date() > new Date(invite.expires_at)) {
      return NextResponse.json(
        { message: "This invitation has expired" },
        { status: 410 }
      )
    }

    if (invite.status === "revoked") {
      return NextResponse.json(
        { message: "This invitation has been revoked" },
        { status: 410 }
      )
    }

    if (invite.status === "accepted") {
      return NextResponse.json(
        { message: "This invitation has already been used" },
        { status: 410 }
      )
    }

    // Security check — the logged-in user must match the invited email
    if (user.email !== invite.email) {
      return NextResponse.json(
        {
          message:
            "The email in your account does not match the email this invitation was sent to",
        },
        { status: 403 }
      )
    }

    // Mark invite as accepted
    const { error: updateError } = await supabase
      .from("invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id)

    if (updateError) {
      console.error("[invites/accept] Error updating invite status:", updateError)
      return NextResponse.json(
        { message: "Failed to accept invite" },
        { status: 500 }
      )
    }

    // Check if membership already exists (graceful re-acceptance)
    const { data: existingMembership } = await supabase
      .from("memberships")
      .select("id")
      .eq("org_id", invite.org_id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingMembership) {
      // 🔹 Even if membership exists, still link technician if needed
      if (invite.technician_id) {
        const { error: linkError } = await supabase
          .from("technicians")
          .update({ linked_user_id: user.id })
          .eq("id", invite.technician_id)
          .is("linked_user_id", null)  // avoid overwriting if already linked

        if (linkError) {
          console.error("[invites/accept] Error linking technician:", linkError)
          // Not critical, we can still return success
        }
      }

      return NextResponse.json(
        { success: true, message: "You are already a member of this organization" },
        { status: 200 }
      )
    }

    // Create membership
    const { error: membershipError } = await supabase
      .from("memberships")
      .insert([
        {
          org_id: invite.org_id,
          user_id: user.id,
          role: invite.role,
        },
      ])

    if (membershipError) {
      console.error("[invites/accept] Error creating membership:", membershipError)
      return NextResponse.json(
        { message: "Failed to create membership" },
        { status: 500 }
      )
    }

    // 🔹 Link technician if this invite had a technician_id
    if (invite.technician_id) {
      const { error: linkError } = await supabase
        .from("technicians")
        .update({ linked_user_id: user.id })
        .eq("id", invite.technician_id)
        .is("linked_user_id", null)  // ensure not already linked

      if (linkError) {
        console.error("[invites/accept] Error linking technician:", linkError)
        // Not critical; we can still return success, but log it.
      }
    }

    return NextResponse.json(
      { success: true, message: "Invitation accepted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("[invites/accept] Unhandled error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
