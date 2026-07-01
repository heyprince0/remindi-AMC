'use client';

import { BillingCycle } from '@/lib/billing-types';
import {
  calculatePrice,
  formatCurrency,
  getDiscountPercentage,
} from '@/lib/billing-helpers';

interface PriceDisplayProps {
  basePrice: number;
  billingCycle: BillingCycle;
  showDiscount?: boolean;
}

export default function PriceDisplay({
  basePrice,
  billingCycle,
  showDiscount = true,
}: PriceDisplayProps) {
  const price = calculatePrice(basePrice, billingCycle);
  const discount = getDiscountPercentage(billingCycle);

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{formatCurrency(price)}</span>
        <span className="text-gray-600">
          {billingCycle === 'monthly'
            ? '/month'
            : `/${billingCycle.replace('-', ' ')}`}
        </span>
      </div>
      {showDiscount && discount > 0 && (
        <p className="mt-1 text-sm text-green-600 font-medium">
          Save {discount}%
        </p>
      )}
    </div>
  );
}
