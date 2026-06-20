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
    const { email, role, orgId } = await request.json()

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
        { error: 'Only admins can invite members' },
        { status: 403 }
      )
    }

    // Check if organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, owner_id')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Check if user with this email already exists
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // Generate invite token
    const inviteToken = crypto.getRandomValues(new Uint8Array(32))
    const tokenHex = Array.from(inviteToken).map(b => b.toString(16).padStart(2, '0')).join('')

    // Create invite record
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

    const { data: inviteData, error: inviteError } = await supabase
      .from('invites')
      .insert({
        org_id: orgId,
        email: email.toLowerCase(),
        role: role || 'member',
        token: tokenHex,
        invited_by: user.id,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invite:', inviteError)
      return NextResponse.json(
        { error: 'Failed to create invite' },
        { status: 500 }
      )
    }

    // Send invite email
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/accept/${tokenHex}`
    
    try {
      await triggerInviteMemberEmail(
        email,
        inviterProfile?.full_name || 'Team',
        org.name,
        role || 'member',
        inviteLink
      )
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
      // Return success but include warning that email may not have sent
      return NextResponse.json({
        success: true,
        invite: inviteData,
        emailWarning: 'Invite created but email may not have been sent. You can resend it from the pending invites list.',
      })
    }

    return NextResponse.json({
      success: true,
      invite: inviteData,
    })
  } catch (error) {
    console.error('Invite creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
