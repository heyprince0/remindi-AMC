export const runtime = 'nodejs'
export const maxDuration = 60

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NOTIFY_AT_DAYS = [3, 0, -1, -3, -7]

const TEMPLATE_LANGUAGE: Record<string, string> = {
  soon_service: 'en',
  service_notcompleted: 'en',
  contract_ending_soon: 'en',
  contract_end: 'en',
}

function formatPhone(phone: string): string | null {
  let digits = String(phone ?? '').replace(/\D/g, '')
  digits = digits.replace(/^0+/, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return null
}

function clean(value: unknown, fallback = '-'): string {
  const s = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 200)
  return s || fallback
}

async function sendWA(templateName: string, phone: string, components: Record<string, unknown>) {
  const authkey = process.env.MSG91_AUTHKEY
  const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER
  const namespace = process.env.MSG91_NAMESPACE

  if (!authkey || !integratedNumber || !namespace) {
    console.error('[WA] Missing MSG91 env vars — check AUTHKEY, INTEGRATED_NUMBER, NAMESPACE')
    return { delivered: false, result: 'Missing MSG91 config' }
  }

  const cleanPhone = formatPhone(phone)
  if (!cleanPhone) {
    console.warn(`[WA] Invalid phone format: "${phone}"`)
    return { delivered: false, result: 'Invalid phone number format' }
  }

  try {
    const payload = {
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
          to_and_components: [{ to: [cleanPhone], components }],
        },
      },
    }

    const res = await fetch(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      {
        method: 'POST',
        headers: { authkey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const result = await res.json().catch(() => ({}))

    // Log full MSG91 response so failures are visible in Vercel logs
    console.log(
      `[WA] template="${templateName}" to="${cleanPhone}" httpStatus=${res.status}`,
      JSON.stringify(result)
    )

    const delivered =
      res.ok &&
      result?.hasError !== true &&
      result?.status !== 'fail' &&
      result?.type !== 'error'

    return { delivered, result }
  } catch (error) {
    console.error('[WA] fetch threw:', error)
    return { delivered: false, result: String(error) }
  }
}

export async function GET() {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ── SERVICE REMINDERS ─────────────────────────────────────────────────────
    const in7Days = new Date(today); in7Days.setDate(today.getDate() + 7)
    const ago30Days = new Date(today); ago30Days.setDate(today.getDate() - 30)

    const { data: contracts } = await supabase
      .from('contracts')
      .select('*, customers(name, phone)')
      .gte('next_service_date', ago30Days.toISOString().split('T')[0])
      .lte('next_service_date', in7Days.toISOString().split('T')[0])
      .eq('status', 'active')

    let sent = 0, skipped = 0
    const errors: string[] = []

    if (contracts?.length) {
      // Build owner maps
      const orgIds = [...new Set(contracts.map((c) => c.org_id).filter(Boolean))]
      const { data: orgs } = await supabase.from('organizations').select('id, owner_id').in('id', orgIds)

      const orgOwnerMap: Record<string, string> = {}
      for (const org of orgs || []) { if (org.owner_id) orgOwnerMap[org.id] = org.owner_id }

      const ownerIds = Object.values(orgOwnerMap).filter(Boolean)
      const ownerPhoneMap: Record<string, string> = {}
      const ownerNameMap: Record<string, string> = {}

      if (ownerIds.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, phone, full_name').in('id', ownerIds)
        for (const p of profiles || []) {
          if (p.phone) ownerPhoneMap[p.id] = p.phone
          if (p.full_name) ownerNameMap[p.id] = p.full_name
        }

        // Fill gaps from auth.users
        const missingIds = ownerIds.filter((id) => !ownerPhoneMap[id] || !ownerNameMap[id])
        if (missingIds.length) {
          const { data: { users } } = await supabase.auth.admin.listUsers()
          for (const u of users || []) {
            if (missingIds.includes(u.id)) {
              if (!ownerPhoneMap[u.id] && u.phone) ownerPhoneMap[u.id] = u.phone
              if (!ownerNameMap[u.id] && u.user_metadata?.full_name)
                ownerNameMap[u.id] = u.user_metadata.full_name
            }
          }
        }
      }

      // Process contracts one by one (sequential avoids MSG91 rate-limit)
      for (const contract of contracts) {
        const nextDate = new Date(contract.next_service_date)
        nextDate.setHours(0, 0, 0, 0)
        const daysUntil = Math.round(
          (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (!NOTIFY_AT_DAYS.includes(daysUntil)) { skipped++; continue }

        const ownerId = orgOwnerMap[contract.org_id]
        const ownerPhone = ownerId ? ownerPhoneMap[ownerId] : null
        if (!ownerPhone) { skipped++; continue }

        const ownerName = (ownerId ? ownerNameMap[ownerId] : null) || 'Contractor'
        const customerName = contract.customers?.name || 'Customer'
        const customerPhone = contract.customers?.phone || 'Not available'

        const waType = daysUntil > 0 ? 'upcoming' : 'not_completed'
        const templateName = waType === 'upcoming' ? 'soon_service' : 'service_notcompleted'
        const dedupKey = `${waType}_${contract.id}_${contract.next_service_date}`

        const { data: already } = await supabase
          .from('reminders_log')
          .select('id')
          .eq('contract_id', contract.id)
          .eq('message_type', `whatsapp_${dedupKey}`)
          .eq('status', 'sent')
          .maybeSingle()

        if (already) { skipped++; continue }

        const components = {
          body_1: { type: 'text', value: clean(ownerName, 'there') },
          body_2: { type: 'text', value: clean(customerName) },
          body_3: { type: 'text', value: clean(contract.contract_name || 'Service') },
          body_4: { type: 'text', value: clean(contract.next_service_date) },
          body_5: { type: 'text', value: clean(customerPhone, 'Not available') },
          button_1: { subtype: 'url', type: 'text', value: contract.id },
        }

        // Small fixed delay between sends to avoid MSG91 rate-limit
        await new Promise((r) => setTimeout(r, 300))
        const { delivered, result } = await sendWA(templateName, ownerPhone, components)

        if (delivered) { sent++ } else { errors.push(`Contract ${contract.id}: ${JSON.stringify(result)}`) }

        await supabase.from('reminders_log').insert({
          org_id: contract.org_id,
          contract_id: contract.id,
          sent_at: new Date().toISOString(),
          message_type: `whatsapp_${dedupKey}`,
          status: delivered ? 'sent' : 'failed',
          recipient_phone: formatPhone(ownerPhone) || ownerPhone,
          whatsapp_sent: delivered,
          whatsapp_response: result,
        })
      }
    }

    // ── AMC EXPIRY REMINDERS ─────────────────────────────────────────────────
    const in30DaysStr = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0]
    const ago1DayStr  = new Date(today.getTime() - 86400000).toISOString().split('T')[0]

    const { data: amcContracts } = await supabase
      .from('contracts')
      .select('*, customers(name, phone)')
      .gte('end_date', ago1DayStr)
      .lte('end_date', in30DaysStr)
      .eq('status', 'active')

    let amcSent = 0, amcSkipped = 0

    if (amcContracts?.length) {
      const amcOrgIds = [...new Set(amcContracts.map((c) => c.org_id).filter(Boolean))]
      const { data: amcOrgs } = await supabase
        .from('organizations').select('id, owner_id').in('id', amcOrgIds)

      const amcOrgOwnerMap: Record<string, string> = {}
      for (const org of amcOrgs || []) { if (org.owner_id) amcOrgOwnerMap[org.id] = org.owner_id }

      const amcOwnerIds = Object.values(amcOrgOwnerMap).filter(Boolean)
      const amcOwnerPhoneMap: Record<string, string> = {}
      const amcOwnerNameMap: Record<string, string> = {}

      if (amcOwnerIds.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, phone, full_name').in('id', amcOwnerIds)
        for (const p of profiles || []) {
          if (p.phone) amcOwnerPhoneMap[p.id] = p.phone
          if (p.full_name) amcOwnerNameMap[p.id] = p.full_name
        }

        const missingIds = amcOwnerIds.filter((id) => !amcOwnerPhoneMap[id] || !amcOwnerNameMap[id])
        if (missingIds.length) {
          const { data: { users } } = await supabase.auth.admin.listUsers()
          for (const u of users || []) {
            if (missingIds.includes(u.id)) {
              if (!amcOwnerPhoneMap[u.id] && u.phone) amcOwnerPhoneMap[u.id] = u.phone
              if (!amcOwnerNameMap[u.id] && u.user_metadata?.full_name)
                amcOwnerNameMap[u.id] = u.user_metadata.full_name
            }
          }
        }
      }

      for (const contract of amcContracts) {
        if (!contract.end_date) continue

        const endDate = new Date(contract.end_date); endDate.setHours(0, 0, 0, 0)
        const daysUntilEnd = Math.round(
          (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
        const isNotifyDay =
          (daysUntilEnd >= -1 && daysUntilEnd <= 0) ||
          (daysUntilEnd >= 28 && daysUntilEnd <= 30)
        if (!isNotifyDay) { amcSkipped++; continue }

        const ownerId = amcOrgOwnerMap[contract.org_id]
        const contractorPhone = ownerId ? amcOwnerPhoneMap[ownerId] : null
        if (!ownerId || !contractorPhone) { amcSkipped++; continue }

        const contractorName = amcOwnerNameMap[ownerId] || 'Contractor'
        const customerName = contract.customers?.name || 'Customer'
        const customerPhone = contract.customers?.phone || 'Not available'
        const serviceType = contract.contract_name || 'Service'
        const reminderType = daysUntilEnd <= 0 ? 'contract_end' : 'contract_ending_soon'
        const dedupKey = `${reminderType}_${contract.id}`

        const { data: already } = await supabase
          .from('reminders_log')
          .select('id')
          .eq('contract_id', contract.id)
          .eq('message_type', `whatsapp_${dedupKey}`)
          .eq('status', 'sent')
          .maybeSingle()

        if (already) { amcSkipped++; continue }

        const components = {
          body_1: { type: 'text', value: clean(customerName, 'Customer') },
          body_2: { type: 'text', value: clean(contractorName, 'Contractor') },
          body_3: { type: 'text', value: clean(serviceType, 'Service') },
          body_4: { type: 'text', value: clean(contract.end_date) },
          body_5: { type: 'text', value: clean(contractorPhone, 'Not available') },
          button_1: { subtype: 'url', type: 'text', value: contract.id },
        }

        await new Promise((r) => setTimeout(r, 300))
        const { delivered, result } = await sendWA(reminderType, contractorPhone, components)
        if (delivered) amcSent++

        await supabase.from('reminders_log').insert({
          org_id: contract.org_id,
          contract_id: contract.id,
          sent_at: new Date().toISOString(),
          message_type: `whatsapp_${dedupKey}`,
          status: delivered ? 'sent' : 'failed',
          recipient_phone: formatPhone(contractorPhone) || contractorPhone,
          whatsapp_sent: delivered,
          whatsapp_response: result,
        })
      }
    }

    return NextResponse.json({
      sent, skipped, amcSent, amcSkipped,
      errors: errors.length ? errors : undefined,
    })
  } catch (error) {
    console.error('[WA CRON] Fatal error:', error)
    return NextResponse.json({ error: 'Failed', detail: String(error) }, { status: 500 })
  }
}
