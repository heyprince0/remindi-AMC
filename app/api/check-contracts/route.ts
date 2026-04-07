import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const today = new Date()
    const in7Days = new Date()
    in7Days.setDate(today.getDate() + 7)

    const in7DaysStr = in7Days.toISOString().split('T')[0]

    const { data: contracts } = await supabase
      .from('contracts')
      .select('*, customers(name)')
      .lte('next_service_date', in7DaysStr)
      .eq('status', 'active')

    if (!contracts?.length) {
      return NextResponse.json({ sent: 0 })
    }

    let sent = 0
    for (const contract of contracts) {
      const nextDate = new Date(contract.next_service_date)
      const daysUntil = Math.ceil(
        (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      let title = ''
      let body = ''

      if (daysUntil < 0) {
        title = '🔴 Service Overdue!'
        body = `${contract.contract_name} for ${contract.customers?.name} is ${Math.abs(daysUntil)} days overdue`
      } else if (daysUntil === 0) {
        title = '🟠 Service Due Today!'
        body = `${contract.contract_name} for ${contract.customers?.name} is due today`
      } else {
        title = '🟡 Service Due Soon'
        body = `${contract.contract_name} for ${contract.customers?.name} is due in ${daysUntil} days`
      }

      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: contract.user_id, title, body, url: '/' }),
      })
      sent++
    }

    return NextResponse.json({ sent })
  } catch (error) {
    console.error('check-contracts error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
