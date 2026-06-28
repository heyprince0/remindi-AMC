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

const NOTIFY_AT_DAYS = [7, 3, 1, 0, -1, -3, -7, -14, -30]

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

    const { data: contracts, error: dbError } = await supabase
      .from('contracts')
      .select('*, customers(name)')
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

    // ✅ FIX: Look for either 'admin' or 'owner'
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('org_id, user_id, role')
      .in('role', ['admin', 'owner'])

    if (membershipsError) {
      console.error('Error fetching memberships:', membershipsError)
      return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
    }

    const orgAdminMap: Record<string, string> = {}
    for (const m of memberships || []) {
      orgAdminMap[m.org_id] = m.user_id
    }

    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json({ error: 'Failed to fetch user emails' }, { status: 500 })
    }

    const userEmailMap: Record<string, string> = {}
    for (const u of users || []) {
      if (u.email) userEmailMap[u.id] = u.email
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

      const adminUserId = orgAdminMap[contract.org_id]
      if (!adminUserId) {
        skipped++
        console.warn(`No admin/owner found for org ${contract.org_id}, contract ${contract.id}`)
        continue
      }

      const userEmail = userEmailMap[adminUserId]
      if (!userEmail) {
        skipped++
        console.warn(`No email for admin ${adminUserId}, contract ${contract.id}`)
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
