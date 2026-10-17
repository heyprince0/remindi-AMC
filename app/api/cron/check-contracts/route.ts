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

export async function GET() {
  // Guard: CRON_SECRET must be set — empty string would accept any request
  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET env var is not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('NEXT_PUBLIC_APP_URL is not set')
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is missing' }, { status: 500 })
  }

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

    const in7DaysStr   = in7Days.toISOString().split('T')[0]
    const ago30DaysStr = ago30Days.toISOString().split('T')[0]

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
        const ownerPhoneMap: Record<string, string> = {}
        const ownerNameMap:  Record<string, string> = {}

        if (ownerIds.length) {
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
                if (!ownerEmailMap[u.id] && u.email)                    ownerEmailMap[u.id] = u.email
                if (!ownerPhoneMap[u.id] && u.phone)                    ownerPhoneMap[u.id] = u.phone
                if (!ownerNameMap[u.id]  && u.user_metadata?.full_name) ownerNameMap[u.id]  = u.user_metadata.full_name
              }
            }
          }
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

          const customerName  = contract.customers?.name  || 'Unknown'
          const customerPhone = contract.customers?.phone || 'Not available'
          const ownerId       = orgOwnerMap[contract.org_id]

          if (!ownerId) {
            skipped++
            continue
          }

          const userEmail  = ownerEmailMap[ownerId]
          const ownerPhone = ownerPhoneMap[ownerId]
          const ownerName  = ownerNameMap[ownerId] || 'Contractor'

          if (!userEmail && !ownerPhone) {
            skipped++
            continue
          }

          // ── Email ──
          if (userEmail) {
            let result
            if (daysUntil < 0) {
              result = await sendAMCExpiredEmail(
                userEmail, contract.contract_name, contract.next_service_date, customerName
              )
            } else if (daysUntil === 0) {
              // ✅ FIXED: Added the 3 missing arguments required by email-service.ts
              result = await sendServiceReminderEmail(
                userEmail, 
                contract.contract_name, 
                contract.next_service_date, 
                customerName,
                contract.contract_name || 'Service',
                customerPhone,
                ownerName
              )
            } else {
              result = await sendAMCExpiryReminderEmail(
                userEmail, contract.contract_name, contract.next_service_date, customerName
              )
            }

            if (result.success) {
              sent++
            } else {
              errors.push(`Contract ${contract.id}: ${result.error}`)
            }
          }

          // ── WhatsApp ──
          if (ownerPhone) {
            const waType   = daysUntil > 0 ? 'upcoming' : 'not_completed'
            const dedupKey = `${waType}_${contract.id}_${contract.next_service_date}`

            // FIX C1: filter by status='sent' so failed rows don't block retries forever
            const { data: already } = await supabase
              .from('reminders_log')
              .select('id')
              .eq('contract_id', contract.id)
              .eq('message_type', `whatsapp_${dedupKey}`)
              .eq('status', 'sent')
              .maybeSingle()

            if (!already) {
              try {
                // ✅ FIXED URL: Added /whatsapp/
                const waRes = await fetch(`${appUrl}/api/whatsapp/send-contract-reminder`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-internal-secret': process.env.CRON_SECRET!,
                  },
                  body: JSON.stringify({
                    orgId:           contract.org_id,
                    contractorPhone: ownerPhone,
                    contractorName:  ownerName,
                    customerName,
                    customerPhone,
                    serviceType:     contract.contract_name || 'Service',
                    date:            contract.next_service_date,
                    contractId:      contract.id,
                    type:            waType,
                    dedupKey,
                  }),
                })
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

    // FIX C4: extend lower bound 1 day back so a missed D-0 cron run is caught next day
    const ago1Day = new Date(today)
    ago1Day.setDate(today.getDate() - 1)
    const ago1DayStr = ago1Day.toISOString().split('T')[0]

    const { data: amcContracts, error: amcError } = await supabase
      .from('contracts')
      .select(`
        *,
        customers(name, phone)
      `)
      .gte('end_date', ago1DayStr)   // FIX: was todayStr — now catches yesterday's missed D-0
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

      const amcOwnerIds    = Object.values(amcOrgOwnerMap).filter(Boolean)
      const amcOwnerPhoneMap: Record<string, string> = {}
      const amcOwnerNameMap:  Record<string, string> = {}

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

      const missingAmcOwnerIds = amcOwnerIds.filter(id => !amcOwnerPhoneMap[id] || !amcOwnerNameMap[id])
      if (missingAmcOwnerIds.length) {
        const { data: { users } } = await supabase.auth.admin.listUsers()
        for (const u of users || []) {
          if (missingAmcOwnerIds.includes(u.id)) {
            if (!amcOwnerPhoneMap[u.id] && u.phone)                    amcOwnerPhoneMap[u.id] = u.phone
            if (!amcOwnerNameMap[u.id]  && u.user_metadata?.full_name) amcOwnerNameMap[u.id]  = u.user_metadata.full_name
          }
        }
      }

      for (const contract of amcContracts) {
        if (!contract.end_date) continue

        const endDate = new Date(contract.end_date)
        endDate.setHours(0, 0, 0, 0)
        const daysUntilEnd = Math.round(
          (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )

        // FIX C4: daysUntilEnd === -1 catches a missed D-0 run from yesterday
        // FIX: ±2 day window on D-30 so cron timing drift doesn't miss it
        const isNotifyDay =
          (daysUntilEnd >= -1 && daysUntilEnd <= 0) ||      // D-0 + 1 day grace
          (daysUntilEnd >= 28 && daysUntilEnd <= 30)        // D-30 window
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
        const contractorName  = amcOwnerNameMap[ownerId] || 'Contractor'

        if (!contractorPhone) {
          amcSkipped++
          console.warn(`No phone for owner ${ownerId}, contract ${contract.id}`)
          continue
        }

        const customerName  = contract.customers?.name  || 'Customer'
        const customerPhone = contract.customers?.phone || 'Not available'
        const serviceType   = contract.contract_name    || 'Service'

        // daysUntilEnd <= 0 covers both D-0 and the D+1 grace catch
        const reminderType = daysUntilEnd <= 0 ? 'contract_end' : 'contract_ending_soon'
        const dedupKey     = `${reminderType}_${contract.id}`

        // FIX C2: Block 2 was missing dedup entirely — added here with status='sent'
        // This also prevents the ±2 day window from firing contract_ending_soon 3 times
        const { data: amcAlready } = await supabase
          .from('reminders_log')
          .select('id')
          .eq('contract_id', contract.id)
          .eq('message_type', `whatsapp_${dedupKey}`)
          .eq('status', 'sent')
          .maybeSingle()

        if (amcAlready) {
          amcSkipped++
          continue
        }

        try {
          // ✅ FIXED URL: Added /whatsapp/
          const waRes = await fetch(`${appUrl}/api/whatsapp/send-contract-reminder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': process.env.CRON_SECRET!,
            },
            body: JSON.stringify({
              orgId:           contract.org_id,
              contractorPhone: contractorPhone,
              contractorName:  contractorName,
              customerName:    customerName,
              customerPhone:   customerPhone,
              serviceType:     serviceType,
              date:            contract.end_date,
              contractId:      contract.id,
              type:            reminderType,
              dedupKey:        dedupKey,
            }),
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
      errors: errors.length ? errors : undefined,
    })
  } catch (error) {
    console.error('check-contracts error:', error)
    return NextResponse.json({ error: 'Failed', detail: String(error) }, { status: 500 })
  }
}
