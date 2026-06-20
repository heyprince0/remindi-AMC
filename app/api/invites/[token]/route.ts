import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    // Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select(`
        *,
        organizations!invites_org_id_fkey(name),
        inviter:profiles!invites_invited_by_fkey(full_name)
      `)
      .eq('token', token)
      .single()

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      )
    }

    // Check if invite is still valid
    if (invite.status !== 'pending') {
      return NextResponse.json({
        invite,
        status: invite.status,
        valid: false,
      })
    }

    const expiresAt = new Date(invite.expires_at)
    const isExpired = expiresAt < new Date()

    if (isExpired) {
      return NextResponse.json({
        invite,
        status: 'expired',
        valid: false,
      })
    }

    return NextResponse.json({
      invite,
      status: 'pending',
      valid: true,
    })
  } catch (error) {
    console.error('Error fetching invite:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
