import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { planId, billingCycle, orgId } = await req.json();

    // 1. Get plan details from DB
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // 2. Determine amount based on billing cycle
    const amountMap: Record<string, number> = {
      monthly: plan.price_monthly,
      quarterly: plan.price_quarterly,
      'semi-annual': plan.price_semi_annual,
      annual: plan.price_annual,
    };
    const amount = amountMap[billingCycle] || plan.price_monthly;

    if (amount === 0) {
      // If free plan, just activate subscription without payment
      // (Free trial logic can go here, but we'll handle it separately)
      return NextResponse.json({ error: 'Free plan does not require payment' }, { status: 400 });
    }

    // 3. Create Razorpay order
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `order_${orgId}_${Date.now()}`,
      notes: { orgId, planId, billingCycle },
    });

    // 4. Store pending transaction
    await supabase.from('payment_transactions').insert({
      org_id: orgId,
      amount,
      status: 'pending',
      razorpay_order_id: order.id,
      plan_id: planId,
      billing_cycle: billingCycle,
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('[Create Order]', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
