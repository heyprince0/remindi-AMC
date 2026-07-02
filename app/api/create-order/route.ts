import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

// Trim environment variables to avoid hidden newlines
const keyId = process.env.RAZORPAY_KEY_ID?.trim()!;
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()!;

if (!keyId || !keySecret || !supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables for payment creation.');
}

const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const { planId, billingCycle, orgId } = await req.json();

    // Validate required fields
    if (!planId || !billingCycle || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, billingCycle, orgId' },
        { status: 400 }
      );
    }

    // 1. Fetch plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      console.error('[Plan fetch error]', planError);
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // 2. Determine amount in paise
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

    // 4. Insert pending transaction
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
      return NextResponse.json(
        { error: `Database insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    // 5. Return success with trimmed public key
    const publicKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || keyId;
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: publicKey,
    });
  } catch (error: any) {
    console.error('[Create Order] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
