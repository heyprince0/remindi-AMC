import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { encryptToken } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

interface VerifyOtpBody {
  orgId: string
  phoneNumber: string
  otp: string
}

interface Msg91VerifyResponse {
  access_token?: string
  integrated_number_id?: string
  message?: string
  [key: string]: unknown
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

    const authkey = process.env.MSG91_AUTHKEY
    if (!authkey) return NextResponse.json({ error: 'MSG91 configuration is missing' }, { status: 500 })

    const msg91Response = await fetch('https://control.msg91.com/api/v5/whatsapp/verify-number', {
      method: 'POST',
      headers: { authkey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phoneNumber, otp }),
    })
    const result = (await msg91Response.json()) as Msg91VerifyResponse

    if (!msg91Response.ok || !result.access_token || !result.integrated_number_id) {
      return NextResponse.json({ error: result.message ?? 'Failed to verify OTP' }, { status: msg91Response.ok ? 502 : msg91Response.status })
    }

    const encryptedToken = await encryptToken(result.access_token)
    const { error } = await getSupabaseAdmin()
      .from('whatsapp_accounts')
      .update({ integrated_number_id: result.integrated_number_id, access_token: encryptedToken, status: 'active', connected_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('whatsapp_number', phoneNumber)

    if (error) {
      console.error('Failed to activate WhatsApp account', error)
      return NextResponse.json({ error: 'Failed to save WhatsApp connection' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'WhatsApp connected!' })
  } catch (error: unknown) {
    console.error('WhatsApp OTP verification failed', error)
    return NextResponse.json({ error: 'Failed to verify WhatsApp OTP' }, { status: 500 })
  }
}
