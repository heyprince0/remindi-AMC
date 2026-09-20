import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

interface InitiateOtpBody {
  orgId: string
  phoneNumber: string
}

interface Msg91Response {
  message?: string
  [key: string]: unknown
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase configuration is missing')
  }

  return createClient(url, serviceRoleKey)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<InitiateOtpBody>
    const orgId = body.orgId?.trim()
    const phoneNumber = body.phoneNumber?.trim()

    if (!orgId || !phoneNumber) {
      return NextResponse.json({ error: 'orgId and phoneNumber are required' }, { status: 400 })
    }

    const authkey = process.env.MSG91_AUTHKEY
    if (!authkey) {
      return NextResponse.json({ error: 'MSG91 configuration is missing' }, { status: 500 })
    }

    const msg91Response = await fetch('https://control.msg91.com/api/v5/whatsapp/add-number', {
      method: 'POST',
      headers: { authkey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phoneNumber }),
    })
    const result = (await msg91Response.json()) as Msg91Response

    if (!msg91Response.ok) {
      return NextResponse.json({ error: result.message ?? 'Failed to send OTP' }, { status: msg91Response.status })
    }

    const { error } = await getSupabaseAdmin()
      .from('whatsapp_accounts')
      .upsert({ org_id: orgId, whatsapp_number: phoneNumber, status: 'pending' }, { onConflict: 'org_id' })

    if (error) {
      console.error('Failed to save pending WhatsApp account', error)
      return NextResponse.json({ error: 'Failed to save WhatsApp account' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'OTP sent' })
  } catch (error: unknown) {
    console.error('WhatsApp OTP initiation failed', error)
    return NextResponse.json({ error: 'Failed to initiate WhatsApp verification' }, { status: 500 })
  }
}
