import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { triggerInviteMemberEmail } from '@/lib/email-actions'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

export async function POST(request: NextRequest) {
  try {
    const { action, inviteId, orgId } = await request.json()

    // Get the current user from the Authorization header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin in the organization
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can manage invites' },
        { status: 403 }
      )
    }

    // Get the invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('id', inviteId)
      .eq('org_id', orgId)
      .single()

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      )
    }

    if (action === 'revoke') {
      // Mark invite as revoked
      const { error: updateError } = await supabase
        .from('invites')
        .update({ status: 'revoked' })
        .eq('id', inviteId)

      if (updateError) {
        console.error('Error revoking invite:', updateError)
        return NextResponse.json(
          { error: 'Failed to revoke invite' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Invite revoked',
      })
    } else if (action === 'resend') {
      // Check if invite is still pending
      if (invite.status !== 'pending') {
        return NextResponse.json(
          { error: `Cannot resend a ${invite.status} invite` },
          { status: 400 }
        )
      }

      // Check if not expired
      const expiresAt = new Date(invite.expires_at)
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Invite has expired' },
          { status: 400 }
        )
      }

      // Get organization and inviter info
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single()

      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      // Resend email
      const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/accept/${invite.token}`
      
      try {
        await triggerInviteMemberEmail(
          invite.email,
          inviterProfile?.full_name || 'Team',
          org?.name || 'Team',
          invite.role || 'member',
          inviteLink
        )
      } catch (emailError) {
        console.error('Email resend failed:', emailError)
        return NextResponse.json(
          { error: 'Failed to resend email' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Invite resent successfully',
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Invite management error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
