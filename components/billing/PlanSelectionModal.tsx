'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PlanCard from './PlanCard';

type BillingCycle = 'monthly' | 'quarterly' | 'semi-annual' | 'annual';

interface Plan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_quarterly: number;
  price_semi_annual: number;
  price_annual: number;
  features: string[];
  max_contracts: number;
  max_customers: number;
  max_technicians: number;
  max_team_seats: number;
  max_quotations_monthly: number;
  max_invoices_monthly: number;
}

interface PlanSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (plan: Plan, billingCycle: BillingCycle) => void;
}

const CYCLE_LABELS: Record<BillingCycle, { label: string; period: string }> = {
  monthly: { label: 'Monthly', period: 'month' },
  quarterly: { label: '3 Months', period: '3 months' },
  'semi-annual': { label: '6 Months', period: '6 months' },
  annual: { label: 'Yearly', period: 'year' },
};

export default function PlanSelectionModal({
  isOpen,
  onClose,
  onSelectPlan,
}: PlanSelectionModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly');

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('price_monthly', { ascending: true });

        if (error) throw error;
        // Parse features if stored as JSON string
        const parsed = (data || []).map((p: any) => ({
          ...p,
          features: Array.isArray(p.features) ? p.features : JSON.parse(p.features || '[]'),
        }));
        // Filter out the free plan – we already show it on the billing page
        const filtered = parsed.filter((p: Plan) => p.id !== 'free');
        setPlans(filtered);
      } catch (error) {
        console.error('Error fetching plans:', error);
        toast.error('Failed to load plans');
      } finally {
        setLoading(false);
      }
    };
    if (isOpen) fetchPlans();
  }, [isOpen]);

  const getPrice = (plan: Plan) => {
    const map: Record<BillingCycle, number> = {
      monthly: plan.price_monthly,
      quarterly: plan.price_quarterly,
      'semi-annual': plan.price_semi_annual,
      annual: plan.price_annual,
    };
    return map[selectedCycle] || 0;
  };

  const handleSelect = (plan: Plan) => {
    onSelectPlan(plan, selectedCycle);
    onClose();
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="!max-w-4xl w-[95vw]">
          <div className="flex justify-center items-center py-20">
            <Loader2 className="size-12 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // If no plans (other than free) are found, show a message
  if (plans.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="!max-w-lg w-[95vw]">
          <div className="text-center py-12">
            <p className="text-gray-500">No paid plans available at the moment.</p>
            <Button onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/*
        IMPORTANT: the "!" prefix forces this max-width to win over any
        default max-w-* class baked into your base Dialog component
        (shadcn's dialog.tsx usually ships with sm:max-w-lg by default,
        which was silently overriding max-w-screen-xl before and causing
        the cramped, narrow modal in the screenshot).
      */}
      <DialogContent className="!max-w-4xl w-[95vw] max-h-[85vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl sm:text-3xl font-bold text-center">
            Choose Your Plan
          </DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base">
            Select the plan that fits your business needs. Upgrade anytime.
          </DialogDescription>
        </DialogHeader>

        {/* Billing Cycle Tabs */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 my-6 sm:my-8">
          {Object.entries(CYCLE_LABELS).map(([cycle, { label }]) => (
            <button
              key={cycle}
              onClick={() => setSelectedCycle(cycle as BillingCycle)}
              className={`px-5 sm:px-6 py-2 sm:py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCycle === cycle
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Plan Cards Grid — fixed to 2 columns since we only ever show 2 paid plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mt-6">
          {plans.map((plan) => {
            const price = getPrice(plan);
            const isFree = price === 0; // will never be true since we filtered free
            const isPopular = plan.id === 'pro';

            return (
              <PlanCard
                key={plan.id}
                plan={{
                  id: plan.id,
                  name: plan.name,
                  description: plan.description,
                  price,
                  period: CYCLE_LABELS[selectedCycle].period,
                  features: plan.features,
                  isPopular,
                  isFree,
                  onSelect: () => handleSelect(plan),
                }}
              />
            );
          })}
        </div>

        <p className="text-center text-sm text-gray-500 mt-10 sm:mt-12">
          All plans include free updates. Cancel anytime.
        </p>
      </DialogContent>
    </Dialog>
  );
}
