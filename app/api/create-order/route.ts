import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

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
    // 1. Log the raw body
    const rawBody = await req.text();
    console.log('📥 Raw request body:', rawBody);

    // 2. Parse JSON
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // 3. Destructure and trim each value
    const planId = body.planId?.trim();
    const billingCycle = body.billingCycle?.trim();
    const orgId = body.orgId?.trim();

    console.log('📥 Parsed & trimmed:', { planId, billingCycle, orgId });

    // 4. Validate
    if (!planId || !billingCycle || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, billingCycle, orgId' },
        { status: 400 }
      );
    }

    // --- Validate org exists ---
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      console.error('[Org check error]', orgError);
      return NextResponse.json(
        { error: `Organization not found: ${orgId}` },
        { status: 400 }
      );
    }

    // 5. Fetch plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      console.error('[Plan fetch error]', planError);
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // 6. Determine amount
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

    // 7. Create Razorpay order
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `order_${orgId}_${Date.now()}`,
      notes: { orgId, planId, billingCycle },
    });

    // 8. Insert pending transaction
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

    // 9. Return success
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
