import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js' // 👈 use the regular client

// ✅ Use service role key (no auth context needed)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CYCLE_TO_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  'semi-annual': 180,
  annual: 365,
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  // Verify webhook signature
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')

  if (expected !== signature) {
    console.error('Webhook signature mismatch')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)

  // Log the event (idempotency check)
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id, processed')
    .eq('razorpay_event_id', event.id)
    .maybeSingle()

  if (existingEvent?.processed) {
    return NextResponse.json({ success: true, message: 'Already processed' })
  }

  if (!existingEvent) {
    await supabase.from('webhook_events').insert({
      razorpay_event_id: event.id,
      event_type: event.event,
      payload: event,
      processed: false,
    })
  }

  try {
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity
      const notes = payment.notes || {}
      const { org_id, plan_id, billing_cycle } = notes

      if (!org_id || !plan_id || !billing_cycle) {
        console.error('Webhook payment missing notes:', notes)
        return NextResponse.json({ success: true, message: 'Missing notes, skipped' })
      }

      // Check if already processed via verify-payment
      const { data: existingPayment } = await supabase
        .from('payment_transactions')
        .select('id')
        .eq('razorpay_payment_id', payment.id)
        .maybeSingle()

      if (!existingPayment) {
        const durationDays = CYCLE_TO_DAYS[billing_cycle] || 30
        const now = new Date()
        const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

        // Upsert subscription
        await supabase.from('subscriptions').upsert(
          {
            org_id,
            plan_id,
            billing_cycle,
            status: 'active',
            start_date: now.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            next_billing_date: endDate.toISOString().split('T')[0],
            trial_end_date: null,
            last_payment_date: now.toISOString().split('T')[0],
            updated_at: now.toISOString(),
          },
          { onConflict: 'org_id' }
        )

        // Record payment
        await supabase.from('payment_transactions').insert({
          org_id,
          amount: payment.amount,
          currency: payment.currency || 'INR',
          status: 'success',
          razorpay_payment_id: payment.id,
          razorpay_order_id: payment.order_id,
          plan_id,
          billing_cycle,
        })
      }
    }

    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('razorpay_event_id', event.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Webhook processing error:', err)
    await supabase
      .from('webhook_events')
      .update({ error_message: err instanceof Error ? err.message : 'Unknown error' })
      .eq('razorpay_event_id', event.id)

    // Return 200 to stop retries
    return NextResponse.json({ success: true, message: 'Logged with error' })
  }
}
