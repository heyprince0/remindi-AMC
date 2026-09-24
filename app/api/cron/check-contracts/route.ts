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

async function alreadyRemindedToday(
  contractId: string,
  type: string
): Promise<boolean> {
  const todayStr = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('reminders_log')
    .select('id')
    .eq('contract_id', contractId)
    .eq('message_type', `whatsapp_${type}`)
    .gte('sent_at', `${todayStr}T00:00:00`)
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

  const in7Days = new Date(today)
  in7Days.setDate(today.getDate() + 7)
  const in7DaysStr = in7Days.toISOString().split('T')[0]

  let sent = 0
  let skipped = 0
  let failed = 0

  // ─── 1. EXPIRING SOON (end_date within 7 days) ───
  const { data: expiringContracts } = await supabase
    .from('contracts')
    .select(`
      id, contract_name, contract_type, end_date, org_id,
      customers ( id, name ),
      organizations ( id, name, owner_id )
    `)
    .eq('status', 'active')
    .gte('end_date', todayStr)
    .lte('end_date', in7DaysStr)

  for (const contract of expiringContracts || []) {
    const alreadySent = await alreadyRemindedToday(contract.id, 'expiring_soon')
    if (alreadySent) { skipped++; continue }

    const org = contract.organizations as any
    const customer = contract.customers as any

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, full_name, company_name')
      .eq('id', org?.owner_id)
      .maybeSingle()

    if (!profile?.phone) { skipped++; continue }

    const ok = await sendReminder({
      orgId: contract.org_id,
      contractorPhone: profile.phone,
      contractorName: profile.full_name || profile.company_name || 'there',
      customerName: customer?.name || 'your customer',
      serviceType: contract.contract_type || contract.contract_name || 'Service',
      date: formatDate(contract.end_date!),
      contractId: contract.id,
      type: 'expiring_soon',
    })

    ok ? sent++ : failed++
  }

  // ─── 2. EXPIRED (end_date already passed) ───
  const { data: expiredContracts } = await supabase
    .from('contracts')
    .select(`
      id, contract_name, contract_type, end_date, org_id,
      customers ( id, name ),
      organizations ( id, name, owner_id )
    `)
    .eq('status', 'active')
    .lt('end_date', todayStr)

  for (const contract of expiredContracts || []) {
    const alreadySent = await alreadyRemindedToday(contract.id, 'expired')
    if (alreadySent) { skipped++; continue }

    const org = contract.organizations as any
    const customer = contract.customers as any

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, full_name, company_name')
      .eq('id', org?.owner_id)
      .maybeSingle()

    if (!profile?.phone) { skipped++; continue }

    const ok = await sendReminder({
      orgId: contract.org_id,
      contractorPhone: profile.phone,
      contractorName: profile.full_name || profile.company_name || 'there',
      customerName: customer?.name || 'your customer',
      serviceType: contract.contract_type || contract.contract_name || 'Service',
      date: formatDate(contract.end_date!),
      contractId: contract.id,
      type: 'expired',
    })

    ok ? sent++ : failed++
  }

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    failed,
    expiring: expiringContracts?.length || 0,
    expired: expiredContracts?.length || 0,
  })
}
