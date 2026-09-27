import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendAMCExpiryReminderEmail, sendAMCExpiredEmail } from '@/lib/email-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Supabase configuration is missing')
  return createClient(url, serviceRoleKey)
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('91') ? digits : `91${digits}`
}

interface ReminderBody {
  orgId: string
  contractorPhone: string
  contractorName: string
  contractorEmail?: string  // optional — used for email
  customerName: string
  customerPhone: string
  serviceType: string
  date: string
  contractId: string
  contractName?: string     // optional — used for amc-expiry-reminder email
  type: 'due' | 'upcoming' | 'not_completed' | 'expired' | 'contract_end'
  dedupKey?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ReminderBody>
    const {
      orgId,
      contractorPhone,
      contractorName,
      contractorEmail,
      customerName,
      customerPhone,
      serviceType,
      date,
      contractId,
      contractName,
      type,
      dedupKey,
    } = body

    if (
      !orgId || !contractorPhone || !contractorName ||
      !customerName || !customerPhone || !serviceType ||
      !date || !contractId || !type
    ) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    }

    const authkey = process.env.MSG91_AUTHKEY
    if (!authkey) {
      return NextResponse.json({ error: 'MSG91 config missing' }, { status: 500 })
    }

    const cleanContractorPhone = formatPhone(contractorPhone)

    const templateName =
      (type === 'not_completed' || type === 'expired') ? 'service_notcompleted' :
      type === 'upcoming'                              ? 'soon_service' :
      type === 'contract_end'                          ? 'contract_end' :
                                                         'soon_service'

    // ── WhatsApp via MSG91 ──
    const msg91Response = await fetch(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      {
        method: 'POST',
        headers: { authkey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrated_number: '15553241999',
          content_type: 'template',
          payload: {
            messaging_product: 'whatsapp',
            type: 'template',
            template: {
              name: templateName,
              language: { code: 'en', policy: 'deterministic' },
              namespace: '43e589d3_fa5d_4f63_8f02_4ac10a934039',
              to_and_components: [
                {
                  to: [cleanContractorPhone],
                  components: {
                    body_1: { type: 'text', value: contractorName },
                    body_2: { type: 'text', value: customerName },
                    body_3: { type: 'text', value: serviceType },
                    body_4: { type: 'text', value: date },
                    body_5: { type: 'text', value: customerPhone },
                    button_1: { subtype: 'url', type: 'text', value: contractId },
                  },
                },
              ],
            },
          },
        }),
      }
    )

    const result = await msg91Response.json()

    // ── Email via Resend (fire-and-forget) ──
    if (contractorEmail) {
      if (type === 'not_completed' || type === 'expired') {
        // ✅ amc-expired template: service visit overdue (red banner)
        // variables: contractorName, customerName, serviceType, serviceDate, customerPhone
        sendAMCExpiredEmail(contractorEmail, contractorName!, customerName!, serviceType!, date!, customerPhone!)
          .then(r => {
            if (!r.success) console.error('[Reminder] amc-expired email failed:', r.error)
            else console.log('[Reminder] amc-expired email sent:', r.messageId)
          })
          .catch(e => console.error('[Reminder] amc-expired email exception:', e))
      }

      if (type === 'contract_end') {
        // ✅ amc-expiry-reminder template: contract ending soon
        // variables: contractName, expiryDate, customerName
        const emailContractName = contractName ?? serviceType ?? 'AMC Contract'
        sendAMCExpiryReminderEmail(contractorEmail, emailContractName, date!, customerName!)
          .then(r => {
            if (!r.success) console.error('[Reminder] amc-expiry-reminder email failed:', r.error)
            else console.log('[Reminder] amc-expiry-reminder email sent:', r.messageId)
          })
          .catch(e => console.error('[Reminder] amc-expiry-reminder email exception:', e))
      }
    }

    // ── Log to Supabase ──
    const supabase = getSupabaseAdmin()
    await supabase.from('reminders_log').insert({
      org_id: orgId,
      contract_id: contractId,
      sent_at: new Date().toISOString(),
      message_type: `whatsapp_${dedupKey ?? type}`,
      status: msg91Response.ok ? 'sent' : 'failed',
      recipient_phone: contractorPhone,
      whatsapp_sent: msg91Response.ok,
      whatsapp_response: result,
    })

    if (!msg91Response.ok) {
      return NextResponse.json(
        { error: result.message ?? 'Failed to send reminder' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, result })

  } catch (err) {
    console.error('send-contract-reminder error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
