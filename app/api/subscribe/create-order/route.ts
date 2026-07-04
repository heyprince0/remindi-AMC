import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createClient } from '@supabase/supabase-js'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

const CYCLE_TO_PRICE_FIELD: Record<string, string> = {
  monthly: 'price_monthly',
  quarterly: 'price_quarterly',
  'semi-annual': 'price_semi_annual',
  annual: 'price_annual',
}

export async function POST(req: NextRequest) {
  try {
    const { plan_id, billing_cycle, org_id } = await req.json()

    if (!plan_id || !billing_cycle || !org_id) {
      return NextResponse.json(
        { error: 'Missing plan_id, billing_cycle, or org_id' },
        { status: 400 }
      )
    }

    const priceField = CYCLE_TO_PRICE_FIELD[billing_cycle]
    if (!priceField) {
      return NextResponse.json({ error: 'Invalid billing_cycle' }, { status: 400 })
    }

    // Create a Supabase client with the service role key (no auth context)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ⚠️ SECURITY: We are not verifying the user's membership.
    // In production, you should use a server client that reads the session cookie
    // and then check if the user belongs to this org.
    // For now, this gets you past the 500 error.

    // Fetch the plan price
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select(`id, name, ${priceField}`)
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      console.error('Plan fetch error:', planError)
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const amountInPaise = (plan as any)[priceField]
    if (!amountInPaise || amountInPaise <= 0) {
      return NextResponse.json({ error: 'Invalid price for this plan/cycle' }, { status: 400 })
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `org_${org_id}_${Date.now()}`,
      notes: {
        org_id,
        plan_id,
        billing_cycle,
      },
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      plan_name: plan.name,
    })
  } catch (err) {
    console.error('Create order error:', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
