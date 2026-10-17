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

function formatPhone(phone: string): string | null {
  let digits = String(phone ?? '').replace(/\D/g, '')
  digits = digits.replace(/^0+/, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return null
}

function clean(value: unknown, fallback = '-'): string {
  const s = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 200)
  return s || fallback
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orgId, userPhone, userName, expiryDate, planName, type, dedupKey } = body

    if (!orgId || !userPhone || !userName || !expiryDate || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Auth Check (Cron secret)
    const secret = process.env.CRON_SECRET
    const internal = request.headers.get('x-internal-secret')
    if (!secret || internal !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const authkey = process.env.MSG91_AUTHKEY
    const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER
    const namespace = process.env.MSG91_NAMESPACE

    if (!authkey || !integratedNumber || !namespace) {
      return NextResponse.json({ error: 'MSG91 config missing' }, { status: 500 })
    }

    const cleanPhone = formatPhone(userPhone)
    if (!cleanPhone) return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })

    // Template Mapping based on your JSON files
    let templateName = ''
    let components: any = {}

    if (type === 'expired') {
      templateName = 'remindi_subscription_expired'
      components = {
        body_1: { type: 'text', value: clean(userName, 'User') },
        body_2: { type: 'text', value: clean(expiryDate) },
        body_3: { type: 'text', value: clean(planName, 'Standard') },
        // No button_1 needed because your JSON shows a static URL
      }
    } else if (type === 'expiring_soon') {
      templateName = 'remindi_subscription_expiring_soon'
      components = {
        body_1: { type: 'text', value: clean(userName, 'User') },
        body_2: { type: 'text', value: clean(expiryDate) },
        body_3: { type: 'text', value: clean(planName, 'Standard') },
      }
    } else if (type === 'trial_ending') {
      templateName = 'remindi_trial_ending'
      components = {
        body_1: { type: 'text', value: clean(userName, 'User') },
        body_2: { type: 'text', value: clean(expiryDate) },
      }
    } else {
      return NextResponse.json({ error: 'Invalid subscription type' }, { status: 400 })
    }

    const msg91Response = await fetch(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      {
        method: 'POST',
        headers: { authkey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrated_number: integratedNumber,
          content_type: 'template',
          payload: {
            messaging_product: 'whatsapp',
            type: 'template',
            template: {
              name: templateName,
              language: { code: 'en', policy: 'deterministic' }, // Matches your JSON
              namespace,
              to_and_components: [{ to: [cleanPhone], components }],
            },
          },
        }),
      }
    )

    const result = await msg91Response.json().catch(() => ({}))
    const delivered = msg91Response.ok && result?.hasError !== true

    // Log it in reminders_log so we don't send duplicates
    await supabase.from('reminders_log').insert({
      org_id: orgId,
      contract_id: null, // Not a contract reminder
      sent_at: new Date().toISOString(),
      message_type: `whatsapp_${dedupKey ?? type}`,
      status: delivered ? 'sent' : 'failed',
      recipient_phone: cleanPhone,
      whatsapp_sent: delivered,
      whatsapp_response: result,
    })

    if (!delivered) {
      return NextResponse.json({ error: 'Failed to send', result }, { status: 502 })
    }

    return NextResponse.json({ success: true, result })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
