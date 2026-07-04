import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createClient } from '@/lib/supabase/server' // your existing server client helper

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

// Maps billing_cycle to the correct price column on subscription_plans
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

    const supabase = createClient()

    // Verify the logged-in user actually belongs to this org — never trust
    // org_id from the client alone.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('org_id', org_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
    }

    // Fetch the real price from Supabase — never trust an amount sent
    // from the frontend.
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select(`id, name, ${priceField}`)
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const amountInPaise = (plan as any)[priceField]
    if (!amountInPaise || amountInPaise <= 0) {
      return NextResponse.json({ error: 'Invalid price for this plan/cycle' }, { status: 400 })
    }

    // Create the Razorpay order. Notes here are the critical part — they
    // travel with this order through to the webhook payload automatically
    // (unlike the Payment Page custom-field approach we tried before,
    // which required guessing at how custom fields surface in webhooks).
    // Orders API notes are official, documented, and reliable.
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
