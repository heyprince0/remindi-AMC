import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

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
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_id,
      billing_cycle,
      org_id,
      amount,
    } = await req.json()

    // 1. Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature mismatch', { expected: expectedSignature, received: razorpay_signature })
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // 2. Idempotency check
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

    // 3. Upsert subscription
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

    if (subError) {
      console.error('Upsert subscription error:', subError)
      return NextResponse.json({ error: `DB upsert failed: ${subError.message}` }, { status: 500 })
    }

    // 4. Insert payment transaction
    const { error: paymentError } = await supabase
      .from('payment_transactions')
      .insert({
        org_id,
        amount,
        currency: 'INR',
        status: 'success',
        razorpay_payment_id,
        razorpay_order_id,
        plan_id,
        billing_cycle,
      })

    if (paymentError) {
      console.error('Insert payment error:', paymentError)
      return NextResponse.json({ error: `DB insert failed: ${paymentError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Verify payment error:', err)
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
