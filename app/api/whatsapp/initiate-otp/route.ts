import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Supabase configuration is missing')
  return createClient(url, serviceRoleKey)
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, phoneNumber } = await request.json()

    if (!orgId || !phoneNumber) {
      return NextResponse.json(
        { error: 'orgId and phoneNumber are required' },
        { status: 400 }
      )
    }

    const authkey = process.env.MSG91_AUTHKEY
    if (!authkey) {
      return NextResponse.json(
        { error: 'MSG91 configuration is missing' },
        { status: 500 }
      )
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Format phone: strip non-digits, ensure starts with 91
    const digits = phoneNumber.replace(/\D/g, '')
    const cleanPhone = digits.startsWith('91') ? digits : `91${digits}`

    const today = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

    const msg91Response = await fetch(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      {
        method: 'POST',
        headers: {
          authkey,
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
              language: {
                code: 'en',
                policy: 'deterministic',
              },
              namespace: '43e589d3_fa5d_4f63_8f02_4ac10a934039',
              to_and_components: [
                {
                  to: [cleanPhone],
                  components: {
                    body_customer_name: {
                      type: 'text',
                      value: otpCode,           // OTP shown as customer name
                      parameter_name: 'customer_name',
                    },
                    body_service_type: {
                      type: 'text',
                      value: 'WhatsApp Verification',
                      parameter_name: 'service_type',
                    },
                    body_completion_date: {
                      type: 'text',
                      value: today,
                      parameter_name: 'completion_date',
                    },
                    body_business_name: {
                      type: 'text',
                      value: 'Remindi',
                      parameter_name: 'business_name',
                    },
                  },
                },
              ],
            },
          },
        }),
      }
    )

    const result = await msg91Response.json()

    if (!msg91Response.ok) {
      console.error('MSG91 Error:', result)
      return NextResponse.json(
        { error: result.message ?? 'Failed to send OTP' },
        { status: msg91Response.status }
      )
    }

    // Save OTP in DB
    const { error: upsertError } = await getSupabaseAdmin()
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

    if (upsertError) {
      console.error('Failed to save OTP:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save WhatsApp account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'OTP sent' })
  } catch (error: unknown) {
    console.error('initiate-otp failed:', error)
    return NextResponse.json(
      { error: 'Failed to initiate WhatsApp verification' },
      { status: 500 }
    )
  }
}
