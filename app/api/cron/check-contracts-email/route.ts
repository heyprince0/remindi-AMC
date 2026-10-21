export const runtime = 'nodejs'
export const maxDuration = 60

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  sendServiceReminderEmail,
  sendAMCExpiryReminderEmail,
  sendAMCExpiredEmail,
} from '@/lib/email-service'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NOTIFY_AT_DAYS = [3, 0, -1, -3, -7]

export async function GET() {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ── SERVICE REMINDER EMAILS ───────────────────────────────────────────────
    const in7Days   = new Date(today); in7Days.setDate(today.getDate() + 7)
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
      const ownerEmailMap: Record<string, string> = {}
      const ownerPhoneMap: Record<string, string> = {}
      const ownerNameMap:  Record<string, string> = {}

      if (ownerIds.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, phone, full_name').in('id', ownerIds)
        for (const p of profiles || []) {
          if (p.phone)     ownerPhoneMap[p.id] = p.phone
          if (p.full_name) ownerNameMap[p.id]  = p.full_name
        }

        // Fill email + any gaps from auth.users
        const missingIds = ownerIds.filter(
          (id) => !ownerEmailMap[id] || !ownerPhoneMap[id] || !ownerNameMap[id]
        )
        if (missingIds.length) {
          const { data: { users } } = await supabase.auth.admin.listUsers()
          for (const u of users || []) {
            if (missingIds.includes(u.id)) {
              if (!ownerEmailMap[u.id] && u.email) ownerEmailMap[u.id] = u.email
              if (!ownerPhoneMap[u.id] && u.phone) ownerPhoneMap[u.id] = u.phone
              if (!ownerNameMap[u.id]  && u.user_metadata?.full_name)
                ownerNameMap[u.id] = u.user_metadata.full_name
            }
          }
        }
      }

      const tasks = contracts.map(async (contract) => {
        const nextDate = new Date(contract.next_service_date)
        nextDate.setHours(0, 0, 0, 0)
        const daysUntil = Math.round(
          (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (!NOTIFY_AT_DAYS.includes(daysUntil)) { skipped++; return }

        const ownerId   = orgOwnerMap[contract.org_id]
        const userEmail = ownerId ? ownerEmailMap[ownerId] : null
        if (!userEmail) { skipped++; return }

        const ownerName   = (ownerId ? ownerNameMap[ownerId] : null) || 'Contractor'
        const ownerPhone  = (ownerId ? ownerPhoneMap[ownerId] : null) || ''
        const customerName  = contract.customers?.name  || 'Customer'
        const customerPhone = contract.customers?.phone || 'Not available'

        let result
        if (daysUntil < 0) {
          result = await sendAMCExpiredEmail(
            userEmail, contract.contract_name, contract.next_service_date, customerName
          )
        } else if (daysUntil === 0) {
          result = await sendServiceReminderEmail(
            userEmail, contract.contract_name, contract.next_service_date,
            customerName, contract.contract_name || 'Service', customerPhone, ownerName
          )
        } else {
          result = await sendAMCExpiryReminderEmail(
            userEmail, contract.contract_name, contract.next_service_date, customerName
          )
        }

        if (result.success) { sent++ }
        else { errors.push(`Contract ${contract.id}: ${result.error}`) }
      })

      await Promise.all(tasks)
    }

    return NextResponse.json({
      sent, skipped,
      errors: errors.length ? errors : undefined,
    })
  } catch (error) {
    console.error('[EMAIL CRON] Fatal error:', error)
    return NextResponse.json({ error: 'Failed', detail: String(error) }, { status: 500 })
  }
}
