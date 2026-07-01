'use client';

import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

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
    onSelect: () => void;
  };
}

// Helper to format price from paise to rupees with ₹ symbol
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
    onSelect,
  } = plan;

  const displayPrice = isFree ? 'FREE' : formatPrice(price);

  return (
    <div
      className={`relative rounded-2xl border-2 p-6 flex flex-col transition-all hover:shadow-xl ${
        isPopular ? 'border-blue-500 shadow-md' : 'border-gray-200'
      }`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-5 py-1 rounded-full whitespace-nowrap">
          Most Popular
        </span>
      )}
      <div className="flex-1">
        <h3 className="text-2xl font-bold text-gray-900">{name}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
        <div className="mt-4">
          {isFree ? (
            <span className="text-3xl font-bold text-blue-600">FREE</span>
          ) : (
            <div>
              <span className="text-3xl font-bold text-gray-900">{displayPrice}</span>
              <span className="text-sm text-gray-500 ml-1">/ {period}</span>
            </div>
          )}
        </div>
        <ul className="mt-6 space-y-2.5">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="size-4 text-blue-600 shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button
        onClick={onSelect}
        className={`mt-8 w-full py-3 text-base font-semibold ${
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
