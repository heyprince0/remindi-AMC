import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface VerifyOtpBody {
  orgId: string
  phoneNumber: string
  otp: string
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Supabase configuration is missing')
  return createClient(url, serviceRoleKey)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<VerifyOtpBody>
    const orgId = body.orgId?.trim()
    const phoneNumber = body.phoneNumber?.trim()
    const otp = body.otp?.trim()

    if (!orgId || !phoneNumber || !otp) {
      return NextResponse.json({ error: 'orgId, phoneNumber, and otp are required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 1. Fetch the stored OTP for this org
    const { data: account, error: fetchError } = await supabase
      .from('whatsapp_accounts')
      .select('otp_code, status')
      .eq('org_id', orgId)
      .eq('whatsapp_number', phoneNumber)
      .maybeSingle()

    if (fetchError || !account) {
      return NextResponse.json({ error: 'No pending OTP request found' }, { status: 404 })
    }

    // 2. Compare the OTPs
    if (account.otp_code !== otp) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }

    // 3. Correct OTP -> activate the account
    const { error: updateError } = await supabase
      .from('whatsapp_accounts')
      .update({
        status: 'active',
        connected_at: new Date().toISOString(),
        otp_code: null,
      })
      .eq('org_id', orgId)

    if (updateError) {
      console.error('Failed to activate account:', updateError)
      return NextResponse.json({ error: 'Failed to save WhatsApp connection' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'WhatsApp connected!' })
  } catch (error: unknown) {
    console.error('WhatsApp OTP verification failed', error)
    return NextResponse.json({ error: 'Failed to verify WhatsApp OTP' }, { status: 500 })
  }
}
