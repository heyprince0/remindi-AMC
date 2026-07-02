import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

// Trim environment variables to avoid hidden newlines
const keyId = process.env.RAZORPAY_KEY_ID?.trim()!;
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()!;

// Optional: throw if missing to fail fast
if (!keyId || !keySecret || !supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables for payment creation.');
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const { planId, billingCycle, orgId } = await req.json();

    // 1. Get plan details from DB
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      console.error('[Plan fetch error]', planError);
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
    const { error: insertError } = await supabase.from('payment_transactions').insert({
      org_id: orgId,
      amount,
      status: 'pending',
      razorpay_order_id: order.id,
      plan_id: planId,
      billing_cycle: billingCycle,
    });

    if (insertError) {
      console.error('[Insert transaction error]', insertError);
      // Order already created at Razorpay, but we have a DB error – you may want to handle this better
      return NextResponse.json({ error: 'Failed to record transaction' }, { status: 500 });
    }

    // 5. Return the order details with a trimmed key ID
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || keyId, // fallback to server key if public one missing
    });
  } catch (error) {
    console.error('[Create Order]', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
