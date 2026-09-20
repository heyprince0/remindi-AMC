import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface InitiateOtpBody {
  orgId: string
  phoneNumber: string
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Supabase configuration is missing')
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

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const cleanPhone = phoneNumber.replace('+', '')
    const today = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

    const msg91Response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: {
        authkey: authkey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        integrated_number: '15553241999',
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: 'service_completed',
            language: { code: 'en' },
            to_and_components: [
              {
                to: [cleanPhone],
                components: {
                  customer_name: { type: 'text', value: otpCode },
                  service_type: { type: 'text', value: 'Remindi' },
                  completion_date: { type: 'text', value: today },
                  business_name: { type: 'text', value: 'Remindi AMC' },
                },
              },
            ],
          },
        },
      }),
    })

    const result = await msg91Response.json()

    if (!msg91Response.ok) {
      console.error('MSG91 Error:', result)
      return NextResponse.json(
        { error: result.message ?? 'Failed to send OTP' },
        { status: msg91Response.status }
      )
    }

    const { error } = await getSupabaseAdmin()
      .from('whatsapp_accounts')
      .upsert(
        {
          org_id: orgId,
          whatsapp_number: phoneNumber,
          status: 'pending',
          otp_code: otpCode,
        },
        { onConflict: 'org_id' }
      )

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
