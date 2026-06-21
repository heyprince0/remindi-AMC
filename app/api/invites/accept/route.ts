import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    // Get auth session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session || !session.user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { message: "Token is required" },
        { status: 400 }
      )
    }

    // Fetch and validate invite
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .maybeSingle()

    if (inviteError || !invite) {
      return NextResponse.json(
        { message: "Invite not found" },
        { status: 404 }
      )
    }

    // Check if invite is expired
    const expiresAt = new Date(invite.expires_at)
    const now = new Date()
    const isExpired = now > expiresAt

    if (isExpired) {
      return NextResponse.json(
        { message: "This invitation has expired" },
        { status: 410 }
      )
    }

    // Check if invite has been revoked or already used
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

    // Check if user email matches invite email
    if (session.user.email !== invite.email) {
      return NextResponse.json(
        {
          message: "The email in your account does not match the email this invitation was sent to",
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
      console.error("[v0] Error accepting invite:", updateError)
      return NextResponse.json(
        { message: "Failed to accept invite" },
        { status: 500 }
      )
    }

    // Check if user already has membership (in case of re-acceptance)
    const { data: existingMembership } = await supabase
      .from("memberships")
      .select("id")
      .eq("org_id", invite.org_id)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (existingMembership) {
      // User already has membership, just return success
      return NextResponse.json(
        {
          success: true,
          message: "You are already a member of this organization",
        },
        { status: 200 }
      )
    }

    // Create membership record
    const { error: membershipError } = await supabase
      .from("memberships")
      .insert([
        {
          org_id: invite.org_id,
          user_id: session.user.id,
          role: invite.role,
          joined_at: new Date().toISOString(),
        },
      ])

    if (membershipError) {
      console.error("[v0] Error creating membership:", membershipError)
      return NextResponse.json(
        { message: "Failed to create membership" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "Invitation accepted successfully",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[v0] Error in invite accept route:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
