'use client';

import { Button } from '@/components/ui/button';
import { Check, Tag } from 'lucide-react';

interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    description: string;
    price: number;          // in paise
    currency?: string;
    period: string;
    features: string[];
    isPopular?: boolean;
    isFree?: boolean;
    discountPercent?: number;  // e.g. 17 for "Save 17%"
    savingsAmount?: number;    // in paise, e.g. 49500 for "₹495 saved"
    onSelect: () => void;
    disabled?: boolean;       // 👈 new prop
  };
}

const formatPrice = (paise: number) => {
  if (paise === 0) return 'FREE';
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
};

export default function PlanCard({ plan }: PlanCardProps) {
  const {
    name,
    description,
    price,
    period,
    features,
    isPopular = false,
    isFree = false,
    discountPercent = 0,
    savingsAmount = 0,
    onSelect,
    disabled = false,       // 👈 default to false
  } = plan;

  const displayPrice = isFree ? 'FREE' : formatPrice(price);
  const hasOffer = !isFree && discountPercent > 0;

  return (
    <div
      className={`relative rounded-2xl border-2 p-6 sm:p-8 flex flex-col w-full min-w-0 transition-all hover:shadow-xl ${
        isPopular ? 'border-blue-500 shadow-lg' : 'border-gray-200'
      }`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-5 py-1.5 rounded-full whitespace-nowrap shadow">
          Most Popular
        </span>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{name}</h3>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</p>

        <div className="mt-4">
          {isFree ? (
            <span className="text-3xl font-bold text-blue-600">FREE</span>
          ) : (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl sm:text-4xl font-bold text-gray-900 whitespace-nowrap">
                {displayPrice}
              </span>
              <span className="text-sm text-gray-500 whitespace-nowrap">/ {period}</span>
            </div>
          )}

          {hasOffer && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
                <Tag className="size-3" />
                Save {discountPercent}%
              </span>
              {savingsAmount > 0 && (
                <span className="text-xs text-gray-500">
                  You save {formatPrice(savingsAmount)}
                </span>
              )}
            </div>
          )}
        </div>

        <ul className="mt-6 space-y-2.5">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="size-4 text-blue-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <Button
        onClick={onSelect}
        disabled={disabled}          // 👈 apply the disabled prop
        className={`mt-8 w-full py-3.5 text-base font-semibold ${
          isPopular
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
        }`}
        variant={isPopular ? 'default' : 'outline'}
      >
        {isFree ? 'Start Free Trial' : 'Select Plan'}
      </Button>
    </div>
  );
}
