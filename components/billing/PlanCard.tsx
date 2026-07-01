'use client';

import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    description: string;
    price: number;
    currency?: string;
    period: string;
    features: string[];
    isPopular?: boolean;
    isFree?: boolean;
    onSelect: () => void;
  };
}

export default function PlanCard({ plan }: PlanCardProps) {
  const {
    name,
    description,
    price,
    currency = '₹',
    period,
    features,
    isPopular = false,
    isFree = false,
    onSelect,
  } = plan;

  return (
    <div
      className={`relative rounded-2xl border-2 p-8 flex flex-col transition-all hover:shadow-xl ${
        isPopular ? 'border-blue-500 shadow-md' : 'border-gray-200'
      }`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-5 py-1.5 rounded-full">
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
              <span className="text-4xl font-bold text-gray-900">
                {currency}{price.toLocaleString('en-IN')}
              </span>
              <span className="text-sm text-gray-500 ml-1">/ {period}</span>
            </div>
          )}
        </div>
        <ul className="mt-6 space-y-3">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
              <Check className="size-5 text-blue-600 shrink-0 mt-0.5" />
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