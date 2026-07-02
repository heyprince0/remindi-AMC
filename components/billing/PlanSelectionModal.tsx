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

// onSelectPlan is no longer needed – we open Razorpay directly
interface PlanSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CYCLE_LABELS: Record<BillingCycle, { label: string; period: string; months: number }> = {
  monthly: { label: 'Monthly', period: 'month', months: 1 },
  quarterly: { label: '3 Months', period: '3 months', months: 3 },
  'semi-annual': { label: '6 Months', period: '6 months', months: 6 },
  annual: { label: 'Yearly', period: 'year', months: 12 },
};

// Razorpay payment links for each plan and cycle
const PAYMENT_LINKS: Record<string, Record<BillingCycle, string>> = {
  basic: {
    monthly: 'https://rzp.io/rzp/tYnvcz1',
    quarterly: 'https://rzp.io/rzp/pTUiceQb',
    'semi-annual': 'https://rzp.io/rzp/iqyaXDY',
    annual: 'https://rzp.io/rzp/1P1G0fT',
  },
  pro: {
    monthly: 'https://rzp.io/rzp/kCn0ski2',
    quarterly: 'https://rzp.io/rzp/AkQvZYC1',
    'semi-annual': 'https://rzp.io/rzp/fS9DVi4w',
    annual: 'https://rzp.io/rzp/Qtp9IHuV',
  },
};

export default function PlanSelectionModal({
  isOpen,
  onClose,
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

  const getDiscountPercent = (plan: Plan) => {
    const { months } = CYCLE_LABELS[selectedCycle];
    if (months === 1) return 0;
    const currentPrice = getPrice(plan);
    const equivalentMonthlyTotal = plan.price_monthly * months;
    if (!equivalentMonthlyTotal || !currentPrice) return 0;
    const savings = equivalentMonthlyTotal - currentPrice;
    if (savings <= 0) return 0;
    return Math.round((savings / equivalentMonthlyTotal) * 100);
  };

  const getSavingsAmount = (plan: Plan) => {
    const { months } = CYCLE_LABELS[selectedCycle];
    if (months === 1) return 0;
    const currentPrice = getPrice(plan);
    const equivalentMonthlyTotal = plan.price_monthly * months;
    return Math.max(equivalentMonthlyTotal - currentPrice, 0);
  };

  // Updated: redirect to Razorpay payment link
  const handleSelect = (plan: Plan) => {
    const linksForPlan = PAYMENT_LINKS[plan.id];
    if (!linksForPlan) {
      toast.error('Payment link not configured for this plan');
      return;
    }
    const link = linksForPlan[selectedCycle];
    if (!link) {
      toast.error('Payment link not available for this billing cycle');
      return;
    }
    // Open payment link in a new tab
    window.open(link, '_blank');
    onClose(); // close modal after redirect
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

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mt-6">
          {plans.map((plan) => {
            const price = getPrice(plan);
            const isFree = price === 0;
            const isPopular = plan.id === 'pro';
            const discountPercent = getDiscountPercent(plan);
            const savingsAmount = getSavingsAmount(plan);

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
                  discountPercent,
                  savingsAmount,
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
