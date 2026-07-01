'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface BillingCycleToggleProps {
  onCycleChange: (cycle: string) => void;
  className?: string;
}

export default function BillingCycleToggle({ onCycleChange, className }: BillingCycleToggleProps) {
  const [selected, setSelected] = useState('monthly');

  const cycles = [
    { label: 'Monthly', value: 'monthly' },
    { label: 'Quarterly (5% off)', value: 'quarterly' },
    { label: 'Semi-Annual (10% off)', value: 'semi-annual' },
    { label: 'Yearly (15% off)', value: 'annual' },
  ];

  const handleChange = (value: string) => {
    setSelected(value);
    onCycleChange(value);
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {cycles.map((cycle) => (
        <Button
          key={cycle.value}
          variant={selected === cycle.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleChange(cycle.value)}
          className={selected === cycle.value ? 'bg-blue-600 text-white' : ''}
        >
          {cycle.label}
        </Button>
      ))}
    </div>
  );
}
