'use client';

import { useState } from 'react';
import { BillingCycle, Plan } from '@/lib/billing-types';
import { PLANS } from '@/lib/billing-mock-data';
import PlanCard from './plan-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan?: (plan: Plan, billingCycle: BillingCycle) => void;
}

export default function UpgradePlanModal({
  isOpen,
  onClose,
  onSelectPlan,
}: UpgradePlanModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectPlan = async (plan: Plan, billingCycle: BillingCycle) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    onSelectPlan?.(plan, billingCycle);
    setIsLoading(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upgrade Your Plan</DialogTitle>
          <DialogDescription>
            Choose a plan that works best for your growing business
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
          {Object.values(PLANS)
            .filter((plan) => plan.id !== 'free')
            .map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onSelect={handleSelectPlan}
                loading={isLoading}
                buttonText="Upgrade"
              />
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
