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

async function alreadySent(
  contractId: string,
  type: 'expiring_soon' | 'expired'
): Promise<boolean> {
  const { data } = await supabase
    .from('reminders_log')
    .select('id')
    .eq('contract_id', contractId)
    .eq('message_type', `whatsapp_${type}`)
    .limit(1)
    .maybeSingle()
  return !!data
}

async function sendReminder(params: {
  orgId: string
  contractorPhone: string
  contractorName: string
  customerName: string
  serviceType: string
  date: string
  contractId: string
  type: 'expiring_soon' | 'expired'
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

  // Exact target dates
  const tMinus3 = addDays(today, 3)   // end_date == today + 3  → "3 days before expiry"
  const tZero   = todayStr            // end_date == today      → "on expiry day"
  const tPlus3  = addDays(today, -3)  // end_date == today - 3  → "3 days after expiry"

  let sent = 0
  let skipped = 0
  let failed = 0

  // Fetch contracts hitting any of our 3 target dates, in one query
  const { data: contracts } = await supabase
    .from('contracts')
    .select(`
      id, contract_name, contract_type, end_date, org_id, status,
      customers ( id, name ),
      organizations ( id, name, owner_id )
    `)
    .eq('status', 'active')
    .in('end_date', [tMinus3, tZero, tPlus3])

  for (const contract of contracts || []) {
    const endDate = contract.end_date as string

    // Decide which reminder this contract is due for today
    let type: 'expiring_soon' | 'expired' | null = null
    if (endDate === tMinus3) type = 'expiring_soon'
    else if (endDate === tZero) type = 'expiring_soon'
    else if (endDate === tPlus3) type = 'expired'

    if (!type) continue

    // Dedup: only send each type once per contract
    // (expiring_soon fires twice — T-3 and T-0 — so we key on the exact date)
    const dedupKey = `${type}_${endDate}` // unique per (type, end_date)
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
      continue
    }

    const ok = await sendReminder({
      orgId: contract.org_id,
      contractorPhone: profile.phone,
      contractorName: profile.full_name || profile.company_name || 'there',
      customerName: customer?.name || 'your customer',
      serviceType: contract.contract_type || contract.contract_name || 'Service',
      date: formatDate(endDate),
      contractId: contract.id,
      type,
    })

    ok ? sent++ : failed++
  }

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    failed,
    targets: { tMinus3, tZero, tPlus3 },
    matched: contracts?.length || 0,
  })
}
