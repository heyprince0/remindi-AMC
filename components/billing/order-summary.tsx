'use client';

import { OrderSummary as OrderSummaryType } from '@/lib/billing-types';
import {
  calculatePrice,
  formatCurrency,
  formatDate,
  getDiscountPercentage,
} from '@/lib/billing-helpers';
import { Separator } from '@/components/ui/separator';

interface OrderSummaryProps {
  order: OrderSummaryType;
}

export default function OrderSummary({ order }: OrderSummaryProps) {
  const discount = getDiscountPercentage(order.billingCycle);
  const subtotal = order.basePrice;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Order Summary</h3>

      <div className="space-y-3">
        {/* Plan */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Plan</span>
          <span className="font-medium text-gray-900">{order.plan.name}</span>
        </div>

        {/* Billing Cycle */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Billing Cycle</span>
          <span className="font-medium text-gray-900">
            {order.billingCycle.replace(/-/g, ' ')}
          </span>
        </div>

        {/* Subtotal */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium text-gray-900">
            {formatCurrency(subtotal)}
          </span>
        </div>

        {/* Discount */}
        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Discount ({discount}%)</span>
            <span className="font-medium text-green-600">
              -{formatCurrency(subtotal - order.totalPrice)}
            </span>
          </div>
        )}

        <Separator />

        {/* Total */}
        <div className="flex justify-between">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="text-2xl font-bold text-gray-900">
            {formatCurrency(order.totalPrice)}
          </span>
        </div>

        {/* Renewal Info */}
        <div className="mt-4 rounded-md bg-blue-50 p-3">
          <p className="text-sm text-blue-900">
            Your subscription will renew on{' '}
            <span className="font-semibold">{formatDate(order.renewalDate)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
