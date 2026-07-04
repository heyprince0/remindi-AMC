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
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const in7Days = new Date(today)
    in7Days.setDate(today.getDate() + 7)

    const ago30Days = new Date(today)
    ago30Days.setDate(today.getDate() - 30)

    const in7DaysStr = in7Days.toISOString().split('T')[0]
    const ago30DaysStr = ago30Days.toISOString().split('T')[0]

    // Fetch contracts with customer name and also join organizations to get owner_id
    const { data: contracts, error: dbError } = await supabase
      .from('contracts')
      .select(`
        *,
        customers(name),
        organizations!inner(owner_id)
      `)
      .gte('next_service_date', ago30DaysStr)
      .lte('next_service_date', in7DaysStr)
      .eq('status', 'active')

    if (dbError) {
      console.error('DB error fetching contracts:', dbError)
      return NextResponse.json({ error: 'DB query failed', detail: dbError.message }, { status: 500 })
    }

    if (!contracts?.length) {
      return NextResponse.json({ sent: 0, message: 'No contracts to process' })
    }

    // Collect unique owner_ids
    const ownerIds = [...new Set(contracts.map(c => c.organizations?.owner_id).filter(Boolean))]

    // Fetch owner emails from profiles (preferred) or fallback to auth.users
    const ownerEmailMap: Record<string, string> = {}

    // 1. Try profiles
    if (ownerIds.length) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', ownerIds)

      if (!profilesError && profiles) {
        for (const p of profiles) {
          if (p.email) ownerEmailMap[p.id] = p.email
        }
      }
    }

    // 2. For owners missing email in profiles, fallback to auth.users (service role needed)
    const missingIds = ownerIds.filter(id => !ownerEmailMap[id])
    if (missingIds.length) {
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
      if (!usersError && users) {
        for (const u of users) {
          if (missingIds.includes(u.id) && u.email) {
            ownerEmailMap[u.id] = u.email
          }
        }
      } else {
        console.warn('Could not fetch auth users for missing emails:', usersError)
      }
    }

    let sent = 0
    let skipped = 0
    const errors: string[] = []

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
      const ownerId = contract.organizations?.owner_id

      if (!ownerId) {
        skipped++
        console.warn(`No owner found for org ${contract.org_id}, contract ${contract.id}`)
        continue
      }

      const userEmail = ownerEmailMap[ownerId]
      if (!userEmail) {
        skipped++
        console.warn(`No email for owner ${ownerId}, contract ${contract.id}`)
        continue
      }

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

    return NextResponse.json({ sent, skipped, errors: errors.length ? errors : undefined })
  } catch (error) {
    console.error('check-contracts error:', error)
    return NextResponse.json({ error: 'Failed', detail: String(error) }, { status: 500 })
  }
}
