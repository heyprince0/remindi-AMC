import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function addDays(base: Date, days: number): string {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

async function sendReminder(params: {
  orgId: string
  contractorPhone: string
  contractorName: string
  customerName: string
  customerPhone: string
  serviceType: string
  date: string
  contractId: string
  type: 'upcoming' | 'not_completed'
  dedupKey: string
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://remindi.online'
  const res = await fetch(`${appUrl}/api/whatsapp/send-contract-reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return res.ok
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // ── Target dates based on next_service_date ──
  const tMinus3 = addDays(today, 3)   // 3 days before service → "upcoming"
  const tZero   = todayStr            // on service day        → "not_completed"
  const tPlus3  = addDays(today, -3)  // 3 days after service  → "not_completed"

  let sent = 0
  let skipped = 0
  let skippedNoPhone = 0
  let failed = 0

  // Fetch contracts whose next service falls on one of the 3 target dates
  const { data: contracts } = await supabase
    .from('contracts')
    .select(`
      id, contract_name, contract_type, next_service_date, org_id, status,
      customers ( id, name, phone ),
      organizations ( id, name, owner_id )
    `)
    .eq('status', 'active')
    .in('next_service_date', [tMinus3, tZero, tPlus3])

  for (const contract of contracts || []) {
    const serviceDate = contract.next_service_date as string

    // Decide which reminder this contract is due for today
    let type: 'upcoming' | 'not_completed' | null = null
    if (serviceDate === tMinus3) type = 'upcoming'
    else if (serviceDate === tZero) type = 'not_completed'
    else if (serviceDate === tPlus3) type = 'not_completed'

    if (!type) continue

    // Dedup — unique per (type, serviceDate)
    const dedupKey = `${type}_${serviceDate}`
    const { data: existing } = await supabase
      .from('reminders_log')
      .select('id')
      .eq('contract_id', contract.id)
      .eq('message_type', `whatsapp_${dedupKey}`)
      .limit(1)
      .maybeSingle()

    if (existing) {
      skipped++
      continue
    }

    const org = contract.organizations as any
    const customer = contract.customers as any

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, full_name, company_name')
      .eq('id', org?.owner_id)
      .maybeSingle()

    if (!profile?.phone) {
      skipped++
      skippedNoPhone++
      continue
    }

    const customerPhone = customer?.phone || profile.phone

    const ok = await sendReminder({
      orgId: contract.org_id,
      contractorPhone: profile.phone,
      contractorName: profile.full_name || profile.company_name || 'there',
      customerName: customer?.name || 'your customer',
      customerPhone,
      serviceType: contract.contract_name || contract.contract_type || 'Service',
      date: formatDate(serviceDate),
      contractId: contract.id,
      type,
      dedupKey,
    })

    ok ? sent++ : failed++
  }

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    skippedNoPhone,
    failed,
    targets: { tMinus3, tZero, tPlus3 },
    matched: contracts?.length || 0,
  })
}
