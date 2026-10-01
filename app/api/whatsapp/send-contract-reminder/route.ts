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

// Returns a 12-digit Indian number like 919123456789, or null if invalid
function formatPhone(phone: string): string | null {
  let digits = String(phone ?? '').replace(/\D/g, '')
  digits = digits.replace(/^0+/, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return null
}

// WhatsApp template variables: no line breaks, no tabs, no long space runs, never empty
function clean(value: unknown, fallback = '-'): string {
  const s = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 200)
  return s || fallback
}

interface ReminderBody {
  orgId: string
  contractorPhone: string
  contractorName: string
  customerName: string
  customerPhone: string
  serviceType: string
  date: string
  contractId: string
  // Types:
  //   upcoming           → soon_service          (service T-3, uses next_service_date)
  //   not_completed      → service_notcompleted  (service T-0 & T+3, uses next_service_date)
  //   expired            → service_notcompleted  (test button + service T+3 alias)
  //   due                → soon_service          (legacy fallback)
  type: 'due' | 'upcoming' | 'not_completed' | 'expired'
  dedupKey?: string
}

// Allowed callers:
//   1) The cron job (sends header x-internal-secret = CRON_SECRET)
//   2) A logged-in user of the same organization (sends Authorization: Bearer <access_token>)
async function isAuthorized(
  request: NextRequest,
  orgId: string,
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  const internal = request.headers.get('x-internal-secret')
  if (secret && internal && internal === secret) return true

  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return false

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return false
  const userId = data.user.id

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  if (membership) return true

  const { data: ownedOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .eq('owner_id', userId)
    .maybeSingle()
  return !!ownedOrg
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ReminderBody>
    const {
      orgId,
      contractorPhone,
      contractorName,
      customerName,
      customerPhone,
      serviceType,
      date,
      contractId,
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

    const supabase = getSupabaseAdmin()

    if (!(await isAuthorized(request, orgId, supabase))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // The contract must belong to the organization in the request
    const { data: contract } = await supabase
      .from('contracts')
      .select('id')
      .eq('id', contractId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found for this organization' }, { status: 404 })
    }

    const authkey = process.env.MSG91_AUTHKEY
    if (!authkey) {
      return NextResponse.json({ error: 'MSG91 config missing' }, { status: 500 })
    }
    const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER || '15553241999'
    const namespace = process.env.MSG91_NAMESPACE || '43e589d3_fa5d_4f63_8f02_4ac10a934039'

    const cleanContractorPhone = formatPhone(contractorPhone)
    if (!cleanContractorPhone) {
      return NextResponse.json({ error: 'Invalid contractor phone number' }, { status: 400 })
    }

    // ── Template mapping ──
    //   not_completed | expired → service_notcompleted  ("⚠️ Service Visit Not Completed")
    //   upcoming                → soon_service          ("🛠️ Upcoming Service Visit")
    //   due                     → soon_service          (fallback)
    const templateName =
      (type === 'not_completed' || type === 'expired') ? 'service_notcompleted' :
      type === 'upcoming'                              ? 'soon_service' :
                                                         'soon_service'

    const msg91Response = await fetch(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      {
        method: 'POST',
        headers: {
          authkey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrated_number: integratedNumber,
          content_type: 'template',
          payload: {
            messaging_product: 'whatsapp',
            type: 'template',
            template: {
              name: templateName,
              language: {
                code: 'en',
                policy: 'deterministic',
              },
              namespace,
              to_and_components: [
                {
                  to: [cleanContractorPhone],
                  components: {
                    body_1: { type: 'text', value: clean(contractorName, 'there') },
                    body_2: { type: 'text', value: clean(customerName) },
                    body_3: { type: 'text', value: clean(serviceType, 'Service') },
                    body_4: { type: 'text', value: clean(date) },
                    body_5: { type: 'text', value: clean(customerPhone, 'Not available') },
                    button_1: {
                      subtype: 'url',
                      type: 'text',
                      value: contractId,
                    },
                  },
                },
              ],
            },
          },
        }),
      }
    )

    const result = await msg91Response.json().catch(() => ({}))

    // MSG91 can answer HTTP 200 and still report a failure in the body
    const delivered =
      msg91Response.ok &&
      result?.hasError !== true &&
      result?.status !== 'fail' &&
      result?.type !== 'error'

    const { error: logError } = await supabase.from('reminders_log').insert({
      org_id: orgId,
      contract_id: contractId,
      sent_at: new Date().toISOString(),
      message_type: `whatsapp_${dedupKey ?? type}`,
      status: delivered ? 'sent' : 'failed',
      recipient_phone: cleanContractorPhone,
      whatsapp_sent: delivered,
      whatsapp_response: result,
    })
    if (logError) {
      // Do not hide this: without a log row, dedup cannot work
      console.error('reminders_log insert failed:', logError.message)
    }

    if (!delivered) {
      return NextResponse.json(
        { error: result?.message ?? result?.errors ?? 'Failed to send reminder', result },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, logged: !logError, result })
  } catch (err) {
    console.error('send-contract-reminder error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
