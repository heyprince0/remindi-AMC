export const runtime = 'nodejs'

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
const CONTRACT_EXPIRY_NOTIFY_DAYS = [30, 0] // 30 days before, and on the day of expiry

export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // ─────────────────────────────────────────────────────────────
    // 1. SERVICE REMINDERS — Email + WhatsApp
    // ─────────────────────────────────────────────────────────────
    const in7Days = new Date(today)
    in7Days.setDate(today.getDate() + 7)

    const ago30Days = new Date(today)
    ago30Days.setDate(today.getDate() - 30)

    const in7DaysStr = in7Days.toISOString().split('T')[0]
    const ago30DaysStr = ago30Days.toISOString().split('T')[0]

    // FIX: added customers(name, phone) — phone is needed for WhatsApp
    const { data: contracts, error: dbError } = await supabase
      .from('contracts')
      .select(`
        *,
        customers(name, phone)
      `)
      .gte('next_service_date', ago30DaysStr)
      .lte('next_service_date', in7DaysStr)
      .eq('status', 'active')

    if (dbError) {
      console.error('DB error fetching contracts:', dbError)
      return NextResponse.json({ error: 'DB query failed', detail: dbError.message }, { status: 500 })
    }

    let sent = 0
    let skipped = 0
    const errors: string[] = []

    if (contracts?.length) {
      const orgIds = [...new Set(contracts.map(c => c.org_id).filter(Boolean))]

      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('id, owner_id')
        .in('id', orgIds)

      if (orgError) {
        console.error('Error fetching organizations:', orgError)
      } else {
        const orgOwnerMap: Record<string, string> = {}
        for (const org of orgs || []) {
          if (org.owner_id) orgOwnerMap[org.id] = org.owner_id
        }

        const ownerIds = Object.values(orgOwnerMap).filter(Boolean)
        const ownerEmailMap: Record<string, string> = {}
        // FIX: added phone + name maps for WhatsApp
        const ownerPhoneMap: Record<string, string> = {}
        const ownerNameMap: Record<string, string> = {}

        if (ownerIds.length) {
          // FIX: added phone, full_name to profiles query
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email, phone, full_name')
            .in('id', ownerIds)

          if (!profilesError && profiles) {
            for (const p of profiles) {
              if (p.email)     ownerEmailMap[p.id] = p.email
              if (p.phone)     ownerPhoneMap[p.id] = p.phone
              if (p.full_name) ownerNameMap[p.id]  = p.full_name
            }
          }
        }

        // Fallback to auth.users for missing email / phone / name
        const missingIds = ownerIds.filter(
          id => !ownerEmailMap[id] || !ownerPhoneMap[id] || !ownerNameMap[id]
        )
        if (missingIds.length) {
          const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
          if (!usersError && users) {
            for (const u of users) {
              if (missingIds.includes(u.id)) {
                if (!ownerEmailMap[u.id] && u.email) ownerEmailMap[u.id] = u.email
                if (!ownerPhoneMap[u.id] && u.phone) ownerPhoneMap[u.id] = u.phone
                if (!ownerNameMap[u.id] && u.user_metadata?.full_name) {
                  ownerNameMap[u.id] = u.user_metadata.full_name
                }
              }
            }
          }
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL
        if (!appUrl) {
          console.error('NEXT_PUBLIC_APP_URL is not set — WhatsApp calls will be skipped')
        }

        for (const contract of contracts) {
          const nextDate = new Date(contract.next_service_date)
          nextDate.setHours(0, 0, 0, 0)
          const daysUntil = Math.round(
            (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          )

          if (!NOTIFY_AT_DAYS.includes(daysUntil)) {
            skipped++
            continue
          }

          const customerName = contract.customers?.name || 'Unknown'
          const customerPhone = contract.customers?.phone || 'Not available'
          const ownerId = orgOwnerMap[contract.org_id]

          if (!ownerId) {
            skipped++
            continue
          }

          const userEmail = ownerEmailMap[ownerId]
          const ownerPhone = ownerPhoneMap[ownerId]
          const ownerName = ownerNameMap[ownerId] || 'Contractor'

          // Skip only if both channels are unavailable
          if (!userEmail && !ownerPhone) {
            skipped++
            continue
          }

          // ── Email ──
          if (userEmail) {
            let result
            if (daysUntil < 0) {
              result = await sendAMCExpiredEmail(
                userEmail,
                contract.contract_name,
                contract.next_service_date,
                customerName
              )
            } else if (daysUntil === 0) {
              result = await sendServiceReminderEmail(
                userEmail,
                contract.contract_name,
                contract.next_service_date,
                customerName
              )
            } else {
              result = await sendAMCExpiryReminderEmail(
                userEmail,
                contract.contract_name,
                contract.next_service_date,
                customerName
              )
            }

            if (result.success) {
              sent++
            } else {
              errors.push(`Contract ${contract.id}: ${result.error}`)
            }
          }

          // FIX: WhatsApp for service reminders — this was missing entirely
          if (ownerPhone && appUrl) {
            const waType = daysUntil > 0 ? 'upcoming' : 'not_completed'
            const dedupKey = `${waType}_${contract.id}_${contract.next_service_date}`

            // Dedup check — don't send the same WhatsApp twice for the same service date
            const { data: already } = await supabase
              .from('reminders_log')
              .select('id')
              .eq('contract_id', contract.id)
              .eq('message_type', `whatsapp_${dedupKey}`)
              .maybeSingle()

            if (!already) {
              try {
                const waRes = await fetch(
                  `${appUrl}/api/send-contract-reminder`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-internal-secret': process.env.CRON_SECRET || '',
                    },
                    body: JSON.stringify({
                      orgId: contract.org_id,
                      contractorPhone: ownerPhone,
                      contractorName: ownerName,
                      customerName,
                      customerPhone,
                      serviceType: contract.contract_name || 'Service',
                      date: contract.next_service_date,
                      contractId: contract.id,
                      type: waType,
                      dedupKey,
                    }),
                  }
                )
                if (!waRes.ok) {
                  const errData = await waRes.json().catch(() => ({}))
                  console.error(`WA service reminder failed for contract ${contract.id}:`, errData)
                }
              } catch (err) {
                console.error(`WA service reminder error for contract ${contract.id}:`, err)
              }
            }
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. AMC CONTRACT EXPIRY WHATSAPP REMINDERS
    // ─────────────────────────────────────────────────────────────
    const in30Days = new Date(today)
    in30Days.setDate(today.getDate() + 30)
    const in30DaysStr = in30Days.toISOString().split('T')[0]

    // FIX: added gte(todayStr) lower bound — previously fetched all historically expired contracts
    const { data: amcContracts, error: amcError } = await supabase
      .from('contracts')
      .select(`
        *,
        customers(name, phone)
      `)
      .gte('end_date', todayStr)
      .lte('end_date', in30DaysStr)
      .eq('status', 'active')

    if (amcError) {
      console.error('DB error fetching AMC contracts:', amcError)
    }

    let amcSent = 0
    let amcSkipped = 0

    if (amcContracts?.length) {
      const amcOrgIds = [...new Set(amcContracts.map(c => c.org_id).filter(Boolean))]
      const { data: amcOrgs } = await supabase
        .from('organizations')
        .select('id, owner_id')
        .in('id', amcOrgIds)

      const amcOrgOwnerMap: Record<string, string> = {}
      for (const org of amcOrgs || []) {
        if (org.owner_id) amcOrgOwnerMap[org.id] = org.owner_id
      }

      const amcOwnerIds = Object.values(amcOrgOwnerMap).filter(Boolean)
      const amcOwnerPhoneMap: Record<string, string> = {}
      const amcOwnerNameMap: Record<string, string> = {}

      if (amcOwnerIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, phone, full_name')
          .in('id', amcOwnerIds)

        for (const p of profiles || []) {
          if (p.phone)     amcOwnerPhoneMap[p.id] = p.phone
          if (p.full_name) amcOwnerNameMap[p.id]  = p.full_name
        }
      }

      // Fallback to auth.users for missing phones/names
      const missingAmcOwnerIds = amcOwnerIds.filter(id => !amcOwnerPhoneMap[id] || !amcOwnerNameMap[id])
      if (missingAmcOwnerIds.length) {
        const { data: { users } } = await supabase.auth.admin.listUsers()
        for (const u of users || []) {
          if (missingAmcOwnerIds.includes(u.id)) {
            if (!amcOwnerPhoneMap[u.id] && u.phone) amcOwnerPhoneMap[u.id] = u.phone
            if (!amcOwnerNameMap[u.id] && u.user_metadata?.full_name) {
              amcOwnerNameMap[u.id] = u.user_metadata.full_name
            }
          }
        }
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      if (!appUrl) {
        console.error('NEXT_PUBLIC_APP_URL is not set — AMC WhatsApp calls will be skipped')
      }

      for (const contract of amcContracts) {
        if (!contract.end_date) continue

        const endDate = new Date(contract.end_date)
        endDate.setHours(0, 0, 0, 0)
        const daysUntilEnd = Math.round(
          (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )

        // FIX: use a ±2 day tolerance around 30 so cron timing drift doesn't miss the window
        const isNotifyDay = daysUntilEnd === 0 || (daysUntilEnd >= 28 && daysUntilEnd <= 30)
        if (!isNotifyDay) {
          amcSkipped++
          continue
        }

        const ownerId = amcOrgOwnerMap[contract.org_id]
        if (!ownerId) {
          amcSkipped++
          continue
        }

        const contractorPhone = amcOwnerPhoneMap[ownerId]
        const contractorName = amcOwnerNameMap[ownerId] || 'Contractor'

        if (!contractorPhone) {
          amcSkipped++
          console.warn(`No phone for owner ${ownerId}, contract ${contract.id}`)
          continue
        }

        if (!appUrl) {
          amcSkipped++
          continue
        }

        const customerName = contract.customers?.name || 'Customer'
        const customerPhone = contract.customers?.phone || 'Not available'
        const serviceType = contract.contract_name || 'Service'
        
        // FIX: reminderType now correctly handles the ±2 day tolerance window
        const reminderType = daysUntilEnd === 0 ? 'contract_end' : 'contract_ending_soon'
        const dedupKey = `${reminderType}_${contract.id}`

        try {
          const waRes = await fetch(`${appUrl}/api/send-contract-reminder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': process.env.CRON_SECRET || ''
            },
            body: JSON.stringify({
              orgId: contract.org_id,
              contractorPhone: contractorPhone,
              contractorName: contractorName,
              customerName: customerName,
              customerPhone: customerPhone,
              serviceType: serviceType,
              date: contract.end_date,
              contractId: contract.id,
              type: reminderType,
              dedupKey: dedupKey
            })
          })

          if (waRes.ok) {
            amcSent++
          } else {
            const errData = await waRes.json().catch(() => ({}))
            console.error(`Failed to send WA for contract ${contract.id}:`, errData)
          }
        } catch (err) {
          console.error(`Error triggering WA for contract ${contract.id}:`, err)
        }
      }
    }

    return NextResponse.json({ 
      sent, 
      skipped, 
      amcSent,
      amcSkipped,
      errors: errors.length ? errors : undefined 
    })
  } catch (error) {
    console.error('check-contracts error:', error)
    return NextResponse.json({ error: 'Failed', detail: String(error) }, { status: 500 })
  }
}
