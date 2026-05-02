export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
      return NextResponse.json({ sent: 0 })
    }

    let sent = 0
    const errors: string[] = []

    for (const contract of contracts) {
      const nextDate = new Date(contract.next_service_date)
      nextDate.setHours(0, 0, 0, 0)
      const daysUntil = Math.round(
        (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (!NOTIFY_AT_DAYS.includes(daysUntil)) continue

      let title = ''
      let body = ''

      if (daysUntil < 0) {
        title = '🔴 Service Overdue!'
        body = `${contract.contract_name} for ${contract.customers?.name} is ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} overdue`
      } else if (daysUntil === 0) {
        title = '🟠 Service Due Today!'
        body = `${contract.contract_name} for ${contract.customers?.name} is due today`
      } else {
        title = '🟡 Service Due Soon'
        body = `${contract.contract_name} for ${contract.customers?.name} is due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: contract.user_id, title, body, url: '/' }),
        })
        if (res.ok) {
          sent++
        } else {
          const errText = await res.text()
          errors.push(`Contract ${contract.id}: ${res.status} - ${errText}`)
        }
      } catch (fetchErr) {
        errors.push(`Contract ${contract.id}: fetch failed - ${fetchErr}`)
      }
    }

    return NextResponse.json({ sent, errors: errors.length ? errors : undefined })
  } catch (error) {
    console.error('check-contracts error:', error)
    return NextResponse.json({ error: 'Failed', detail: String(error) }, { status: 500 })
  }
}
