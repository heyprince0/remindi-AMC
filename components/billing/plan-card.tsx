'use client';

import { Plan, BillingCycle } from '@/lib/billing-types';
import { calculatePrice, formatCurrency, getDiscountPercentage } from '@/lib/billing-helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import BillingCycleToggle from './billing-cycle-toggle';
import { useState } from 'react';

interface PlanCardProps {
  plan: Plan;
  onSelect?: (plan: Plan, billingCycle: BillingCycle) => void;
  isSelected?: boolean;
  showToggle?: boolean;
  buttonText?: string;
  loading?: boolean;
}

export default function PlanCard({
  plan,
  onSelect,
  isSelected = false,
  showToggle = true,
  buttonText,
  loading = false,
}: PlanCardProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const price = calculatePrice(plan.basePrice, billingCycle);
  const discount = getDiscountPercentage(billingCycle);

  const isPaid = plan.id !== 'free';

  return (
    <div
      className={`relative flex flex-col rounded-lg border-2 p-6 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      } ${plan.recommended ? 'md:ring-2 md:ring-blue-300 md:ring-offset-2' : ''}`}
    >
      {/* Recommended Badge */}
      {plan.recommended && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white">
          Recommended to start
        </Badge>
      )}

      {/* Plan Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
        <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
      </div>

      {/* Price Section */}
      <div className="mb-6">
        {isPaid ? (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900">
                {formatCurrency(price)}
              </span>
              <span className="text-gray-600">/month</span>
            </div>
            {discount > 0 && (
              <p className="mt-2 text-sm text-green-600 font-medium">
                Save {discount}% with this plan
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {plan.badge}
            </p>
            <p className="text-sm text-gray-600">Then choose a plan</p>
          </div>
        )}
      </div>

      {/* Billing Cycle Toggle (only for paid plans) */}
      {isPaid && showToggle && (
        <div className="mb-6 rounded-lg bg-gray-50 p-3">
          <BillingCycleToggle
            value={billingCycle}
            onChange={setBillingCycle}
          />
        </div>
      )}

      {/* Features List */}
      <div className="mb-6 flex-1">
        <ul className="space-y-3">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <Check className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
              <span className="text-sm text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA Button */}
      <Button
        onClick={() => onSelect?.(plan, billingCycle)}
        disabled={loading}
        className={`w-full ${
          plan.recommended
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
        }`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Processing...
          </span>
        ) : (
          buttonText || (plan.id === 'free' ? 'Start Free Trial' : 'Select Plan')
        )}
      </Button>
    </div>
  );
}
