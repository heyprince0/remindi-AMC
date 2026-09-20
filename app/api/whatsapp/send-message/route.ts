import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { decryptToken } from '@/lib/crypto'

interface SendMessageBody {
  orgId: string
  customerPhone: string
  customerName: string
  serviceType: string
  completionDate: string
  businessName: string
}

interface WhatsAppAccount {
  integrated_number_id: string
  access_token: string
}

interface Msg91Response {
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
    const body = (await request.json()) as Partial<SendMessageBody>
    const orgId = body.orgId?.trim()
    const customerPhone = body.customerPhone?.trim()
    const customerName = body.customerName?.trim()
    const serviceType = body.serviceType?.trim()
    const completionDate = body.completionDate?.trim()
    const businessName = body.businessName?.trim()

    if (!orgId || !customerPhone || !customerName || !serviceType || !completionDate || !businessName) {
      return NextResponse.json({ error: 'All message fields are required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: account, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('integrated_number_id, access_token')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle<WhatsAppAccount>()

    if (accountError) {
      console.error('Failed to fetch WhatsApp account', accountError)
      return NextResponse.json({ error: 'Failed to load WhatsApp account' }, { status: 500 })
    }

    if (!account) return NextResponse.json({ skipped: true })

    const authkey = process.env.MSG91_AUTHKEY
    if (!authkey) return NextResponse.json({ error: 'MSG91 configuration is missing' }, { status: 500 })

    const accessToken = await decryptToken(account.access_token)
    const payload = {
      integrated_number: account.integrated_number_id,
      content_type: 'template',
      payload: {
        to: customerPhone,
        type: 'template',
        template: {
          name: 'service_completed',
          language: { code: 'en' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: customerName },
              { type: 'text', text: serviceType },
              { type: 'text', text: completionDate },
              { type: 'text', text: businessName },
            ],
          }],
        },
      },
    }

    const msg91Response = await fetch('https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: { authkey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = (await msg91Response.json()) as Msg91Response

    const { error: logError } = await supabase.from('whatsapp_logs').insert({
      org_id: orgId,
      customer_phone: customerPhone,
      customer_name: customerName,
      status: msg91Response.ok ? 'sent' : 'failed',
      msg91_response: result,
    })

    if (logError) console.error('Failed to write WhatsApp log', logError)
    if (!msg91Response.ok) {
      return NextResponse.json({ error: result.message ?? 'Failed to send WhatsApp message', result }, { status: msg91Response.status })
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('WhatsApp message sending failed', error)
    return NextResponse.json({ error: 'Failed to send WhatsApp message' }, { status: 500 })
  }
}
