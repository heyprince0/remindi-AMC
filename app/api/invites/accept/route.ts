import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    // Get the current user from the Authorization header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const authToken = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
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
      return NextResponse.json(
        { error: `Invite was already ${invite.status}` },
        { status: 400 }
      )
    }

    const expiresAt = new Date(invite.expires_at)
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invite has expired' },
        { status: 400 }
      )
    }

    // Check if email matches
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email does not match the invite' },
        { status: 400 }
      )
    }

    // Add user to organization as a member
    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({
        org_id: invite.org_id,
        user_id: user.id,
        role: invite.role || 'member',
      })

    if (membershipError) {
      console.error('Error creating membership:', membershipError)
      return NextResponse.json(
        { error: 'Failed to accept invite' },
        { status: 500 }
      )
    }

    // Mark invite as accepted
    const { error: updateError } = await supabase
      .from('invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

    if (updateError) {
      console.error('Error updating invite status:', updateError)
    }

    return NextResponse.json({
      success: true,
      orgId: invite.org_id,
    })
  } catch (error) {
    console.error('Invite accept error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
