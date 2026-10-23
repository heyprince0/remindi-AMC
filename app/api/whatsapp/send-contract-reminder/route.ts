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

interface ReminderBody {
  orgId: string
  contractorPhone: string
  contractorName: string
  customerName: string
  customerPhone: string
  serviceType: string
  date: string
  contractId: string
  type: 'due' | 'upcoming' | 'not_completed' | 'expired' | 'contract_ending_soon' | 'contract_end'
  dedupKey?: string
}

const TEMPLATE_LANGUAGE: Record<string, string> = {
  soon_service:         'en',
  service_notcompleted: 'en',
  contract_ending_soon: 'en',
  contract_end:         'en',
}

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
      orgId, contractorPhone, contractorName, customerName, customerPhone,
      serviceType, date, contractId, type, dedupKey,
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

    const { data: contract } = await supabase
      .from('contracts')
      .select('id')
      .eq('id', contractId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found for this organization' }, { status: 404 })
    }

    // ── ADDED: Check if the Contractor has opted out ──
    const { data: org } = await supabase.from('organizations').select('owner_id').eq('id', orgId).single()
    if (org?.owner_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('receive_whatsapp_notifications')
        .eq('id', org.owner_id)
        .single()
      
      if (profile?.receive_whatsapp_notifications === false) {
        return NextResponse.json({ success: true, message: 'Skipped: Contractor has opted out of reminders' })
      }
    }
    // ──────────────────────────────────────────────────

    const authkey = process.env.MSG91_AUTHKEY
    if (!authkey) {
      return NextResponse.json({ error: 'MSG91_AUTHKEY is missing' }, { status: 500 })
    }

    const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER
    if (!integratedNumber) {
      return NextResponse.json({ error: 'MSG91_INTEGRATED_NUMBER is missing' }, { status: 500 })
    }

    const namespace = process.env.MSG91_NAMESPACE
    if (!namespace) {
      return NextResponse.json({ error: 'MSG91_NAMESPACE is missing' }, { status: 500 })
    }

    const cleanContractorPhone = formatPhone(contractorPhone)
    if (!cleanContractorPhone) {
      return NextResponse.json({ error: 'Invalid contractor phone number' }, { status: 400 })
    }

    const isContractExpiry = type === 'contract_ending_soon' || type === 'contract_end'

    const templateName =
      (type === 'not_completed' || type === 'expired') ? 'service_notcompleted' :
      (type === 'contract_ending_soon')                ? 'contract_ending_soon' :
      (type === 'contract_end')                        ? 'contract_end' :
      type === 'upcoming'                              ? 'soon_service' :
                                                         'soon_service'

    const components = isContractExpiry
      ? {
          body_1: { type: 'text', value: clean(customerName, 'Customer') },
          body_2: { type: 'text', value: clean(contractorName, 'Contractor') },
          body_3: { type: 'text', value: clean(serviceType, 'Service') },
          body_4: { type: 'text', value: clean(date) },
          body_5: { type: 'text', value: clean(contractorPhone, 'Not available') },
          button_1: { subtype: 'url', type: 'text', value: contractId },
        }
      : {
          body_1: { type: 'text', value: clean(contractorName, 'there') },
          body_2: { type: 'text', value: clean(customerName) },
          body_3: { type: 'text', value: clean(serviceType, 'Service') },
          body_4: { type: 'text', value: clean(date) },
          body_5: { type: 'text', value: clean(customerPhone, 'Not available') },
          button_1: { subtype: 'url', type: 'text', value: contractId },
        }

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
                code: TEMPLATE_LANGUAGE[templateName] ?? 'en',
                policy: 'deterministic',
              },
              namespace,
              to_and_components: [
                {
                  to: [cleanContractorPhone],
                  components,
                },
              ],
            },
          },
        }),
      }
    )

    const result = await msg91Response.json().catch(() => ({}))

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
