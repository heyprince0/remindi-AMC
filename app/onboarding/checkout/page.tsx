'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PLANS } from '@/lib/billing-mock-data';
import { calculatePrice, calculateRenewalDate } from '@/lib/billing-helpers';
import OrderSummary from '@/components/billing/order-summary';
import PaymentButton from '@/components/billing/payment-button';
import PaymentSuccess from '@/components/billing/payment-success';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paymentState, setPaymentState] = useState<
    'idle' | 'loading' | 'success'
  >('idle');

  const planId = searchParams.get('plan') || 'starter';
  const billingCycle = (searchParams.get('cycle') || 'monthly') as any;

  const plan = PLANS[planId as keyof typeof PLANS];
  if (!plan || plan.id === 'free') {
    return (
      <div className="text-center">
        <p className="text-red-600">Invalid plan selected</p>
      </div>
    );
  }

  const totalPrice = calculatePrice(plan.basePrice, billingCycle);
  const renewalDate = calculateRenewalDate(billingCycle);

  const handlePayment = async () => {
    setPaymentState('loading');
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setPaymentState('success');
  };

  if (paymentState === 'success') {
    return (
      <div className="space-y-8">
        <PaymentSuccess
          planName={plan.name}
          onContinue={() => router.push('/dashboard')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
        <span>Back to plan selection</span>
      </button>

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Complete Your Order</h1>
        <p className="text-gray-600">
          Review your order and proceed to payment
        </p>
      </div>

      {/* Order Summary */}
      <OrderSummary
        order={{
          plan,
          billingCycle,
          basePrice: plan.basePrice,
          discount:
            totalPrice < plan.basePrice ? plan.basePrice - totalPrice : 0,
          totalPrice,
          renewalDate,
        }}
      />

      {/* Payment Button */}
      <PaymentButton
        onClick={handlePayment}
        loading={paymentState === 'loading'}
      />

      {/* Disclaimer */}
      <div className="rounded-lg bg-gray-50 p-4 text-center">
        <p className="text-xs text-gray-600">
          By proceeding, you agree to our Terms of Service and Privacy Policy.
          You can cancel your subscription anytime.
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
