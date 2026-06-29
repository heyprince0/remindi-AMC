import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ message: "Token is required" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .maybeSingle()

    if (inviteError || !invite) {
      return NextResponse.json({ message: "Invite not found" }, { status: 404 })
    }

    if (new Date() > new Date(invite.expires_at)) {
      return NextResponse.json(
        { message: "This invitation has expired", status: "expired" },
        { status: 410 }
      )
    }

    if (invite.status === "revoked") {
      return NextResponse.json(
        { message: "This invitation has been revoked", status: "revoked" },
        { status: 410 }
      )
    }

    if (invite.status === "accepted") {
      return NextResponse.json(
        { message: "This invitation has already been used", status: "accepted" },
        { status: 410 }
      )
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", invite.org_id)
      .maybeSingle()

    const { data: inviterProfile } = await supabase
      .from("company_profile")
      .select("company_name")
      .eq("user_id", invite.invited_by)
      .maybeSingle()

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      org_id: invite.org_id,          // ✅ ADDED
      businessName: org?.name || "Remindi",
      inviterName: inviterProfile?.company_name || "A team admin",
      expiresAt: invite.expires_at,
      status: invite.status,
      displayName: invite.display_name,
    })
  } catch (error) {
    console.error("[invites/token] Error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
