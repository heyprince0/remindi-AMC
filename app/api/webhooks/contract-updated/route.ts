export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  sendServiceReminderEmail,
  sendAMCExpiryReminderEmail,
  sendAMCExpiredEmail,
} from '@/lib/email-service'

// Verify that the request comes from Supabase (webhook secret)
function isAuthorized(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  // You'll set this secret in Vercel env vars and in the webhook config
  return authHeader === `Bearer ${process.env.WEBHOOK_SECRET}`
}

function getDaysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export async function POST(req: NextRequest) {
  // 1. Verify webhook secret
  if (!isAuthorized(req)) {
    console.warn('[Webhook] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 2. Parse the webhook payload
    const body = await req.json()
    const record = body.record // the new/updated contract row

    if (!record || !record.id) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // 3. Check if we should send an email for this contract
    const daysUntil = getDaysUntil(record.next_service_date)

    // Only send if it's due today or overdue (days <= 0) – you can extend this to positive days if you want.
    // Also, only send once per day using last_email_sent.
    const todayStr = new Date().toISOString().split('T')[0]

    if (daysUntil > 0) {
      // Not due yet – skip
      return NextResponse.json({ message: 'Not due yet', daysUntil })
    }

    // If we already sent an email today for this contract, skip
    if (record.last_email_sent === todayStr) {
      return NextResponse.json({ message: 'Already emailed today' })
    }

    // 4. Get customer name
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('name')
      .eq('id', record.customer_id)
      .single()

    if (customerError) {
      console.error('[Webhook] Customer fetch error:', customerError)
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const customerName = customer?.name || 'Unknown'

    // 5. Find the organization owner's email
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('user_id, role')
      .eq('org_id', record.org_id)
      .eq('role', 'owner')
      .limit(1)

    if (membershipsError || !memberships || memberships.length === 0) {
      console.error('[Webhook] No owner found for org:', record.org_id)
      return NextResponse.json({ error: 'No owner found' }, { status: 404 })
    }

    const ownerUserId = memberships[0].user_id

    // 6. Get owner email from auth.users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    if (usersError) {
      console.error('[Webhook] Failed to fetch users:', usersError)
      return NextResponse.json({ error: 'Failed to get user email' }, { status: 500 })
    }

    const owner = users?.find(u => u.id === ownerUserId)
    const userEmail = owner?.email
    if (!userEmail) {
      console.error('[Webhook] No email for owner:', ownerUserId)
      return NextResponse.json({ error: 'Owner email not found' }, { status: 404 })
    }

    // 7. Send the appropriate email
    let result
    if (daysUntil < 0) {
      result = await sendAMCExpiredEmail(
        userEmail,
        record.contract_name,
        record.next_service_date,
        customerName
      )
    } else if (daysUntil === 0) {
      result = await sendServiceReminderEmail(
        userEmail,
        record.contract_name,
        record.next_service_date,
        customerName
      )
    } else {
      // This case shouldn't happen (daysUntil > 0 already skipped), but just in case:
      result = await sendAMCExpiryReminderEmail(
        userEmail,
        record.contract_name,
        record.next_service_date,
        customerName
      )
    }

    if (result.success) {
      // 8. Update last_email_sent to today so we don't send again
      await supabase
        .from('contracts')
        .update({ last_email_sent: todayStr })
        .eq('id', record.id)

      console.log(`[Webhook] Email sent for contract ${record.id}`)
      return NextResponse.json({ success: true, message: 'Email sent' })
    } else {
      console.error(`[Webhook] Email failed for contract ${record.id}:`, result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
  } catch (error) {
    console.error('[Webhook] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
