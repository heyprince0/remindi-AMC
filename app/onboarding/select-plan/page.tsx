'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BillingCycle, Plan } from '@/lib/billing-types';
import { PLANS } from '@/lib/billing-mock-data';
import { calculateRenewalDate } from '@/lib/billing-helpers';
import PlanCard from '@/components/billing/plan-card';
import PaymentSuccess from '@/components/billing/payment-success';

export default function SelectPlanPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectPlan = async (plan: Plan, billingCycle: BillingCycle) => {
    setIsLoading(true);

    if (plan.id === 'free') {
      // Simulate free trial signup
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSelectedPlan(plan);
      setShowSuccess(true);

      // Auto-redirect after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } else {
      // Go to checkout for paid plans
      router.push(
        `/onboarding/checkout?plan=${plan.id}&cycle=${billingCycle}`,
      );
    }

    setIsLoading(false);
  };

  if (showSuccess) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            You&apos;re all set!
          </h1>
          <p className="text-gray-600">
            Your free trial is active. Redirecting to dashboard...
          </p>
        </div>
        <PaymentSuccess
          planName={selectedPlan?.name || 'Free Trial'}
          onContinue={() => router.push('/dashboard')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold text-gray-900">
          Choose Your Plan
        </h1>
        <p className="text-lg text-gray-600">
          Get started with Remindi and manage your AMC business efficiently
        </p>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.values(PLANS).map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onSelect={handleSelectPlan}
            loading={isLoading}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-600">
        <p>
          No credit card required for free trial.{' '}
          <span className="font-medium">You can upgrade anytime.</span>
        </p>
      </div>
    </div>
  );
}
