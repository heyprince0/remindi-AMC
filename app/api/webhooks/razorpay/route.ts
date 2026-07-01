import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature')!;

  // Verify webhook signature
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    const orderId = payment.order_id;
    const paymentId = payment.id;

    // Update transaction
    await supabase
      .from('payment_transactions')
      .update({
        status: 'success',
        razorpay_payment_id: paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', orderId);

    // Get transaction details
    const { data: tx } = await supabase
      .from('payment_transactions')
      .select('org_id, plan_id, billing_cycle')
      .eq('razorpay_order_id', orderId)
      .single();

    if (tx) {
      // Calculate subscription end date
      const now = new Date();
      const cycleMap: Record<string, number> = {
        monthly: 1,
        quarterly: 3,
        'semi-annual': 6,
        annual: 12,
      };
      const months = cycleMap[tx.billing_cycle] || 1;
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + months);

      // Upsert subscription
      await supabase.from('subscriptions').upsert({
        org_id: tx.org_id,
        plan_id: tx.plan_id,
        status: 'active',
        billing_cycle: tx.billing_cycle,
        start_date: now.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        last_payment_date: now.toISOString().split('T')[0],
        next_billing_date: endDate.toISOString().split('T')[0],
        updated_at: now.toISOString(),
      }, {
        onConflict: 'org_id',
      });
    }
  }

  return NextResponse.json({ received: true });
}
