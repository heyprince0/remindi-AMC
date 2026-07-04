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
    const body = await req.json();

    // ✅ Expect camelCase from frontend
    const { planId, billingCycle, orgId } = body;

    if (!planId || !billingCycle || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, billingCycle, orgId' },
        { status: 400 }
      );
    }

    // Validate org exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: `Organization not found: ${orgId}` },
        { status: 400 }
      );
    }

    // Fetch plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

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

    // ✅ receipt must be <= 40 characters
    const shortReceipt = `ord_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: shortReceipt,
      notes: { orgId, planId, billingCycle },
    });

    // Insert pending transaction
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

    // ✅ Return snake_case keys to match frontend expectations
    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || keyId,
      plan_name: plan.name,
    });
  } catch (error: any) {
    console.error('[Create Order] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
