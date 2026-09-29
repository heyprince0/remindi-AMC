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

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.length > 4 ? `******${d.slice(-4)}` : '****'
}

// Sends the "soon_service" template right now, to the same person the daily cron
// would notify: the owner of the contract's organization (profiles.phone).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const contractId: string | undefined = body?.contractId
    if (!contractId) {
      return NextResponse.json({ error: 'contractId is required' }, { status: 400 })
    }

    if (!process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'CRON_SECRET is not set on the server' }, { status: 500 })
    }

    // ── Who is calling? ──
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    // ── Load the contract ──
    const { data: contract } = await supabase
      .from('contracts')
      .select(`
        id, contract_name, contract_type, next_service_date, org_id,
        customers ( name, phone ),
        organizations ( owner_id )
      `)
      .eq('id', contractId)
      .maybeSingle()

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const org = contract.organizations as any
    const customer = contract.customers as any

    // ── Must belong to this contract's organization ──
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('org_id', contract.org_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!membership && org?.owner_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!contract.next_service_date) {
      return NextResponse.json({ error: 'This contract has no next service date' }, { status: 400 })
    }

    // ── Recipient: the organization owner (same as the cron) ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, whatsapp_number, full_name, company_name')
      .eq('id', org?.owner_id)
      .maybeSingle()

    const contractorPhone: string | undefined = profile?.phone || profile?.whatsapp_number
    if (!contractorPhone) {
      return NextResponse.json(
        { error: 'No phone number saved for the business owner. Add it in Settings → Business Information.' },
        { status: 400 }
      )
    }
    const contractorName = profile?.full_name || profile?.company_name || 'there'

    // ── Small throttle: one test per contract every 15 seconds (each message costs money) ──
    const since = new Date(Date.now() - 15_000).toISOString()
    const { data: recent } = await supabase
      .from('reminders_log')
      .select('id')
      .eq('contract_id', contract.id)
      .like('message_type', 'whatsapp_test_%')
      .gte('sent_at', since)
      .limit(1)
      .maybeSingle()
    if (recent) {
      return NextResponse.json({ error: 'A test was just sent. Please wait a few seconds.' }, { status: 429 })
    }

    // ── Send through the main send route ──
    const origin = new URL(request.url).origin
    const res = await fetch(`${origin}/api/whatsapp/send-contract-reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.CRON_SECRET,
      },
      body: JSON.stringify({
        orgId: contract.org_id,
        contractorPhone,
        contractorName,
        customerName: customer?.name || 'your customer',
        customerPhone: customer?.phone || 'Not available',
        serviceType: contract.contract_name || contract.contract_type || 'Service',
        date: formatDate(contract.next_service_date),
        contractId: contract.id,
        type: 'upcoming', // → soon_service template
        dedupKey: `test_upcoming_${Date.now()}`, // never blocks the real cron reminder
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: typeof data?.error === 'string' ? data.error : 'Failed to send test reminder' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      template: 'soon_service',
      sentTo: { name: contractorName, phone: maskPhone(contractorPhone) },
    })
  } catch (err) {
    console.error('test-contract-reminder error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
