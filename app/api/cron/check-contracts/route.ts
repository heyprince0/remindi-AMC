import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// ───────────── Settings (change here) ─────────────
// Send "service not completed" on the service day itself (in addition to +3 days)?
// Set to false if you think it is too early in the day to say "not completed".
const NOTIFY_ON_SERVICE_DAY = true
// Send contract expiry notices? (now fires the service_notcompleted template)
const ENABLE_CONTRACT_END = true
const CONTRACT_END_DAYS_BEFORE = 7
// ───────────────────────────────────────────────────

type ReminderType = 'upcoming' | 'not_completed'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Supabase configuration is missing')
  return createClient(url, serviceRoleKey)
}

// Today's date in India (YYYY-MM-DD), whatever timezone the server uses
function istToday(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
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

async function sendReminder(params: {
  orgId: string
  contractorPhone: string
  contractorName: string
  customerName: string
  customerPhone: string
  serviceType: string
  date: string
  contractId: string
  type: ReminderType
  dedupKey: string
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://remindi.online'
  try {
    const res = await fetch(`${appUrl}/api/whatsapp/send-contract-reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify(params),
    })
    return res.ok
  } catch (err) {
    console.error('sendReminder fetch failed:', err)
    return false
  }
}

const CONTRACT_SELECT = `
  id, contract_name, contract_type, next_service_date, end_date, org_id, status,
  customers ( id, name, phone ),
  organizations ( id, name, owner_id )
`

type Job = { contract: any; type: ReminderType; dateStr: string }

export async function GET(req: Request) {
  // ── Auth ──
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ?dryRun=1 → show what would be sent, send nothing
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'

  const supabase = getSupabaseAdmin()

  // ── Target dates (India time) ──
  const today = istToday()
  const tMinus3 = addDays(today, 3)   // service in 3 days   → "upcoming"
  const tZero = today                 // service today       → "not_completed"
  const tPlus3 = addDays(today, -3)   // service was 3 days ago → "not_completed"
  const contractEndTarget = addDays(today, CONTRACT_END_DAYS_BEFORE)

  const serviceDates = [tMinus3, tPlus3]
  if (NOTIFY_ON_SERVICE_DAY) serviceDates.push(tZero)

  // ── Find contracts ──
  const jobs: Job[] = []

  const { data: serviceContracts, error: serviceErr } = await supabase
    .from('contracts')
    .select(CONTRACT_SELECT)
    .eq('status', 'active')
    .in('next_service_date', serviceDates)

  if (serviceErr) {
    console.error('cron: contracts query failed:', serviceErr.message)
    return NextResponse.json({ error: 'Contracts query failed' }, { status: 500 })
  }

  for (const c of serviceContracts || []) {
    const d = c.next_service_date as string
    const type: ReminderType = d === tMinus3 ? 'upcoming' : 'not_completed'
    jobs.push({ contract: c, type, dateStr: d })
  }

  if (ENABLE_CONTRACT_END) {
    const { data: endingContracts, error: endErr } = await supabase
      .from('contracts')
      .select(CONTRACT_SELECT)
      .eq('status', 'active')
      .eq('end_date', contractEndTarget)

    if (endErr) console.error('cron: contract_end query failed:', endErr.message)
    for (const c of endingContracts || []) {
      jobs.push({ contract: c, type: 'not_completed', dateStr: c.end_date as string })
    }
  }

  // ── One query: which reminders were already sent successfully ──
  const contractIds = [...new Set(jobs.map((j) => j.contract.id as string))]
  const sentSet = new Set<string>()
  if (contractIds.length) {
    const { data: logs } = await supabase
      .from('reminders_log')
      .select('contract_id, message_type')
      .in('contract_id', contractIds)
      .eq('status', 'sent')
      .like('message_type', 'whatsapp_%')
    for (const l of logs || []) sentSet.add(`${l.contract_id}|${l.message_type}`)
  }

  // ── One query: contractor profiles ──
  const ownerIds = [
    ...new Set(
      jobs
        .map((j) => (j.contract.organizations as any)?.owner_id as string | undefined)
        .filter(Boolean) as string[]
    ),
  ]
  const profileMap = new Map<string, any>()
  if (ownerIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, phone, whatsapp_number, full_name, company_name')
      .in('id', ownerIds)
    for (const p of profiles || []) profileMap.set(p.id, p)
  }

  // ── Process ──
  let sent = 0
  let skipped = 0
  let skippedNoPhone = 0
  let failed = 0
  const details: Record<string, unknown>[] = []

  for (const { contract, type, dateStr } of jobs) {
    const dedupKey = `${type}_${dateStr}`
    const base = {
      contractId: contract.id,
      contract: contract.contract_name,
      type,
      date: dateStr,
    }

    if (sentSet.has(`${contract.id}|whatsapp_${dedupKey}`)) {
      skipped++
      details.push({ ...base, result: 'skipped_already_sent' })
      continue
    }

    const org = contract.organizations as any
    const customer = contract.customers as any
    const profile = org?.owner_id ? profileMap.get(org.owner_id) : null
    const contractorPhone: string | undefined = profile?.whatsapp_number || profile?.phone

    if (!contractorPhone) {
      skipped++
      skippedNoPhone++
      details.push({ ...base, result: 'skipped_no_contractor_phone' })
      continue
    }

    const contractorName = profile.full_name || profile.company_name || 'there'
    const customerName = customer?.name || 'your customer'

    if (dryRun) {
      details.push({
        ...base,
        result: 'would_send',
        contractor: contractorName,
        contractorPhone: maskPhone(contractorPhone),
        customer: customerName,
      })
      continue
    }

    const ok = await sendReminder({
      orgId: contract.org_id,
      contractorPhone,
      contractorName,
      customerName,
      customerPhone: customer?.phone || 'Not available',
      serviceType: contract.contract_name || contract.contract_type || 'Service',
      date: formatDate(dateStr),
      contractId: contract.id,
      type,
      dedupKey,
    })

    if (ok) sent++
    else failed++
    details.push({
      ...base,
      result: ok ? 'sent' : 'failed',
      contractor: contractorName,
      contractorPhone: maskPhone(contractorPhone),
    })
  }

  const summary = {
    success: true,
    dryRun,
    todayIST: today,
    sent,
    skipped,
    skippedNoPhone,
    failed,
    matched: jobs.length,
    targets: {
      tMinus3,
      tZero: NOTIFY_ON_SERVICE_DAY ? tZero : null,
      tPlus3,
      contractEnd: ENABLE_CONTRACT_END ? contractEndTarget : null,
    },
    details,
  }

  console.log('cron service reminders:', JSON.stringify({ ...summary, details: undefined }))
  return NextResponse.json(summary)
}
