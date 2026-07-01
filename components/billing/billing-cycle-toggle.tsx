'use client';

import { BillingCycle } from '@/lib/billing-types';
import { BILLING_CYCLES } from '@/lib/billing-mock-data';

interface BillingCycleToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}

export default function BillingCycleToggle({
  value,
  onChange,
}: BillingCycleToggleProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {BILLING_CYCLES.filter((c) => c.cycle !== 'monthly').map((cycle) => (
        <button
          key={cycle.cycle}
          onClick={() => onChange(cycle.cycle)}
          className={`flex-1 min-w-[100px] rounded-md px-3 py-2 text-xs font-medium transition-all ${
            value === cycle.cycle
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
          }`}
        >
          {cycle.label}
        </button>
      ))}
      <button
        onClick={() => onChange('monthly')}
        className={`flex-1 min-w-[100px] rounded-md px-3 py-2 text-xs font-medium transition-all ${
          value === 'monthly'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
        }`}
      >
        Monthly
      </button>
    </div>
  );
}
