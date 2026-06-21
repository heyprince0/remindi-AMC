import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    if (!token) {
      return NextResponse.json(
        { message: "Token is required" },
        { status: 400 }
      )
    }

    // Fetch invite details
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("*, organizations(name), profiles(full_name)")
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
        {
          message: "This invitation has expired",
          status: "expired",
        },
        { status: 410 }
      )
    }

    // Check if invite has been revoked or already used
    if (invite.status === "revoked") {
      return NextResponse.json(
        {
          message: "This invitation has been revoked",
          status: "revoked",
        },
        { status: 410 }
      )
    }

    if (invite.status === "accepted") {
      return NextResponse.json(
        {
          message: "This invitation has already been used",
          status: "accepted",
        },
        { status: 410 }
      )
    }

    // Return invite details
    return NextResponse.json(
      {
        email: invite.email,
        role: invite.role,
        businessName: invite.organizations?.name || "Remindi",
        inviterName: invite.profiles?.full_name || "Team",
        expiresAt: invite.expires_at,
        status: invite.status,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[v0] Error in invite details route:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
