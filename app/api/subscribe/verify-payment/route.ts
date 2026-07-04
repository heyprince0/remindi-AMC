import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'

const CYCLE_TO_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  'semi-annual': 180,
  annual: 365,
}

export async function POST(req: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_id,
      billing_cycle,
      org_id,
      amount, // in paise, echoed back from the create-order response
    } = await req.json()

    // 1. Verify signature — proves this came from Razorpay, not a spoofed request
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    const supabase = createClient()

    // 2. Idempotency check — if the webhook already processed this exact
    // payment (it can fire before or after this browser callback), don't
    // double-write. razorpay_payment_id has a unique constraint in
    // payment_transactions, so this also protects against a race.
    const { data: existingPayment } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('razorpay_payment_id', razorpay_payment_id)
      .maybeSingle()

    if (existingPayment) {
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    const durationDays = CYCLE_TO_DAYS[billing_cycle] || 30
    const now = new Date()
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

    // 3. Upsert subscription — org_id has a unique constraint, so this
    // updates the existing row for this org rather than creating a
    // duplicate.
    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert(
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

    if (subError) throw subError

    // 4. Record the payment
    const { error: paymentError } = await supabase.from('payment_transactions').insert({
      org_id,
      amount,
      currency: 'INR',
      status: 'success',
      razorpay_payment_id,
      razorpay_order_id,
      plan_id,
      billing_cycle,
    })

    if (paymentError) throw paymentError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Verify payment error:', err)
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
  }
}
